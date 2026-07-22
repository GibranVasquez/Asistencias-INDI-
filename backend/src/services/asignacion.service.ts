import { AsignacionDiaria, Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { verificarAccesoSeccion } from "../utils/accesoSeccion";

export interface DatosAltaAsignacion {
  seccionId: string;
  fecha: string; // YYYY-MM-DD
  trabajadorIds: string[];
}

export interface SugerenciaAsignacion {
  fechaSugerida: string;
  trabajadorIds: string[];
  // Denormalizado igual que en asistencia.service.ts: encargado_seccion no
  // tiene acceso a /trabajadores (rol=rh) para resolver nombres por su cuenta.
  trabajadores: { id: string; nombreCompleto: string }[];
}

export interface TrabajadorMovido {
  trabajadorId: string;
  trabajadorNombre: string;
  seccionAnteriorId: string;
  seccionAnteriorNombre: string;
}

export interface ResultadoAsignacion {
  asignaciones: AsignacionDiaria[];
  movidos: TrabajadorMovido[];
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getUTCDay();
  return dia === 0 || dia === 6;
}

function diaHabilAnterior(fecha: Date): Date {
  const anterior = new Date(fecha);
  do {
    anterior.setUTCDate(anterior.getUTCDate() - 1);
  } while (esFinDeSemana(anterior));
  return anterior;
}

/**
 * Reemplaza las asignaciones de una seccion para un dia dado: los
 * trabajadorId que ya no vienen en la lista se quitan de esta seccion; los
 * que vienen se asignan aqui via upsert sobre el unico trabajadorId+fecha.
 * Si alguno ya estaba asignado ESE dia a OTRA seccion, el upsert lo MUEVE
 * (ya no se rechaza con 409) — el llamado reporta esos movimientos en
 * `movidos` para que quede visible en la respuesta, no sea un cambio
 * silencioso para el encargado de la seccion de origen.
 */
export async function asignarSeccionDelDia(
  usuarioId: string,
  rol: RolUsuario,
  datos: DatosAltaAsignacion
): Promise<ResultadoAsignacion> {
  await verificarAccesoSeccion(usuarioId, rol, datos.seccionId);

  const seccion = await prisma.seccion.findUnique({ where: { id: datos.seccionId } });
  if (!seccion) {
    throw new AppError(404, "La sección indicada no existe.");
  }

  const fecha = aFechaUTC(datos.fecha);
  const trabajadorIds = [...new Set(datos.trabajadorIds)];

  if (trabajadorIds.length > 0) {
    const encontrados = await prisma.trabajador.count({ where: { id: { in: trabajadorIds } } });
    if (encontrados !== trabajadorIds.length) {
      throw new AppError(400, "Uno o más trabajadorId no existen.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const existentesEnSeccion = await tx.asignacionDiaria.findMany({
      where: { seccionId: datos.seccionId, fecha },
    });
    const idsNuevos = new Set(trabajadorIds);
    const aQuitar = existentesEnSeccion.filter((a) => !idsNuevos.has(a.trabajadorId));
    if (aQuitar.length > 0) {
      await tx.asignacionDiaria.deleteMany({ where: { id: { in: aQuitar.map((a) => a.id) } } });
    }

    const asignadosEnOtraSeccion = trabajadorIds.length
      ? await tx.asignacionDiaria.findMany({
          where: { fecha, trabajadorId: { in: trabajadorIds }, seccionId: { not: datos.seccionId } },
          include: {
            trabajador: { select: { nombreCompleto: true } },
            seccion: { select: { nombre: true } },
          },
        })
      : [];
    const movidos: TrabajadorMovido[] = asignadosEnOtraSeccion.map((a) => ({
      trabajadorId: a.trabajadorId,
      trabajadorNombre: a.trabajador.nombreCompleto,
      seccionAnteriorId: a.seccionId,
      seccionAnteriorNombre: a.seccion.nombre,
    }));

    await Promise.all(
      trabajadorIds.map((trabajadorId) =>
        tx.asignacionDiaria.upsert({
          where: { trabajadorId_fecha: { trabajadorId, fecha } },
          update: { seccionId: datos.seccionId, asignadoPor: usuarioId },
          create: { trabajadorId, seccionId: datos.seccionId, fecha, asignadoPor: usuarioId },
        })
      )
    );

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "asignar_seccion_dia",
        entidad: "AsignacionDiaria",
        entidadId: datos.seccionId,
        detalle: { seccionId: datos.seccionId, fecha: datos.fecha, trabajadorIds, movidos } as unknown as Prisma.InputJsonValue,
      },
    });

    const asignaciones = await tx.asignacionDiaria.findMany({ where: { seccionId: datos.seccionId, fecha } });
    return { asignaciones, movidos };
  });
}

export async function obtenerSugerenciaAsignacion(
  usuarioId: string,
  rol: RolUsuario,
  seccionId: string,
  fechaISO: string
): Promise<SugerenciaAsignacion> {
  await verificarAccesoSeccion(usuarioId, rol, seccionId);

  const seccion = await prisma.seccion.findUnique({ where: { id: seccionId } });
  if (!seccion) {
    throw new AppError(404, "La sección indicada no existe.");
  }

  const fechaAnterior = diaHabilAnterior(aFechaUTC(fechaISO));

  const asignaciones = await prisma.asignacionDiaria.findMany({
    where: { seccionId, fecha: fechaAnterior },
    include: { trabajador: { select: { id: true, nombreCompleto: true } } },
  });

  return {
    fechaSugerida: fechaAnterior.toISOString().slice(0, 10),
    trabajadorIds: asignaciones.map((a) => a.trabajadorId),
    trabajadores: asignaciones.map((a) => ({ id: a.trabajador.id, nombreCompleto: a.trabajador.nombreCompleto })),
  };
}

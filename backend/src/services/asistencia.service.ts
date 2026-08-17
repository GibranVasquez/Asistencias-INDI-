import { AsistenciaDiaria, MetodoAsistencia, Prisma, RolUsuario, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { verificarAccesoSeccion } from "../utils/accesoSeccion";

// Denormaliza trabajadorNombre/seccionNombre directo en la respuesta de
// listarAsistencias: recepcion puede leer /asistencias pero NO
// /trabajadores ni /secciones (ambos rol=rh), asi que sin esto el listado
// solo tendria UUIDs — inutilizable para la pantalla que es literalmente
// la razon de ser de ese rol. Evita ademas tener que ampliarle a recepcion
// el acceso a esos catalogos completos (categoria, jefeInmediato, etc.)
// solo para resolver un nombre.
export interface AsistenciaListada extends AsistenciaDiaria {
  trabajadorNombre: string;
  seccionNombre: string;
  trabajadorCategoria: string;
  trabajadorHuellaRegistrada: boolean;
  seccionTramoUbicacion: string | null;
  seccionResponsables: { id: string; username: string; trabajadorNombre: string | null; trabajadorCategoria: string | null }[];
  obraNombre: string;
  horarioNombre: string | null;
}

export interface DatosRegistroAsistencia {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM o HH:MM:SS
  seccionId: string;
  turno: string;
  metodoUsado: MetodoAsistencia;
  ubicacionGPS?: string | null;
}

export interface FiltrosAsistencia {
  fecha?: string; // YYYY-MM-DD, coincidencia exacta
  fechaInicio?: string; // YYYY-MM-DD, usado junto con fechaFin si fecha no se envía
  fechaFin?: string;
  seccionId?: string;
  trabajadorId?: string;
  turno?: string;
  categoria?: string;
}

function normalizarHora(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora;
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

export async function registrarAsistencia(
  trabajadorId: string,
  terminalOrigenId: string,
  datos: DatosRegistroAsistencia
): Promise<AsistenciaDiaria> {
  const trabajador = await prisma.trabajador.findUnique({ where: { id: trabajadorId } });

  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }

  if (trabajador.estatus !== TrabajadorEstatus.activo) {
    throw new AppError(403, "El trabajador no está activo.");
  }

  const seccion = await prisma.seccion.findUnique({ where: { id: datos.seccionId } });
  if (!seccion) {
    throw new AppError(400, "La sección indicada no existe.");
  }

  // terminalOrigenId no se valida contra la BD aquí: terminalAuthMiddleware
  // ya garantizó que corresponde a un Terminal existente y activo.
  const fecha = aFechaUTC(datos.fecha);
  const hora = new Date(`1970-01-01T${normalizarHora(datos.hora)}Z`);

  try {
    return await prisma.asistenciaDiaria.create({
      data: {
        trabajadorId,
        fecha,
        hora,
        seccionId: datos.seccionId,
        turno: datos.turno,
        metodoUsado: datos.metodoUsado,
        terminalOrigenId,
        ubicacionGPS: datos.ubicacionGPS ?? null,
      },
    });
  } catch (error) {
    // El mismo trabajador+terminal+fecha+hora ya existe (restricción única
    // uq_asistencias_trabajador_terminal_fecha_hora) — un reintento de red
    // del Kiosco, un reenvío de backlog de ADMS, o un doble tap accidental
    // dentro del mismo minuto (el Kiosco solo manda HH:MM, sin segundos).
    // No es un error real: se devuelve el registro ya existente en vez de
    // fallar, para que quien reintenta reciba la misma confirmación de
    // éxito — no tiene sentido mostrarle un error a un trabajador parado
    // frente al kiosco por algo que técnicamente ya se registró bien.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existente = await prisma.asistenciaDiaria.findFirst({
        where: { trabajadorId, terminalOrigenId, fecha, hora },
      });
      if (existente) return existente;
    }
    throw error;
  }
}

/**
 * Para la pantalla de confirmación del Kiosco (modo ADMS, ver
 * KioscoPage.tsx): hace polling de "¿hubo una marcación nueva del lector
 * ADMS?". NO se filtra por el terminalId de quien pregunta (el Kiosco que
 * hace polling) — la marcación real la registra el equipo ADMS físico
 * (un Terminal tipo="adms" *distinto* al Kiosco que la muestra), así que
 * filtrar por el terminalId del propio Kiosco nunca encontraría nada.
 * Se filtra por tipo="adms" en su lugar: correcto mientras haya un solo
 * lector ADMS de oficina (el caso real hoy) — si algún día hay más de
 * uno, esto necesitaría un vínculo explícito Kiosco↔lector, no solo
 * "cualquier ADMS".
 */
export async function obtenerAsistenciaMasRecienteDeTerminal(): Promise<AsistenciaListada | null> {
  const registro = await prisma.asistenciaDiaria.findFirst({
    where: { terminalOrigen: { tipo: "adms" } },
    include: {
      trabajador: { select: { nombreCompleto: true, categoria: true, huellaRegistrada: true } },
      seccion: { select: { nombre: true, tramoUbicacion: true, obra: { select: { nombre: true } }, encargados: { select: { id: true, username: true, trabajador: { select: { nombreCompleto: true, categoria: true } } } }, horario: { select: { nombre: true } } } },
    },
    orderBy: { creadoEn: "desc" },
  });

  if (!registro) return null;

  const { trabajador, seccion, ...resto } = registro;
  return {
    ...resto,
    trabajadorNombre: trabajador.nombreCompleto,
    trabajadorCategoria: trabajador.categoria,
    trabajadorHuellaRegistrada: trabajador.huellaRegistrada,
    seccionNombre: seccion.nombre,
    seccionTramoUbicacion: seccion.tramoUbicacion,
    seccionResponsables: seccion.encargados.map((encargado) => ({ id: encargado.id, username: encargado.username, trabajadorNombre: encargado.trabajador?.nombreCompleto ?? null, trabajadorCategoria: encargado.trabajador?.categoria ?? null })),
    obraNombre: seccion.obra.nombre,
    horarioNombre: seccion.horario?.nombre ?? null,
  };
}

/**
 * encargado_seccion no tiene un scoping implicito como rh (que ve todo) —
 * debe mandar un seccionId, y tiene que ser una de las suyas
 * (verificarAccesoSeccion), sin importar que mas venga en el filtro. Sin
 * esto, cualquier encargado podria leer asistencias de OTRA seccion con
 * solo cambiar el query param.
 */
export async function listarAsistencias(
  usuarioId: string,
  rol: RolUsuario,
  filtros: FiltrosAsistencia
): Promise<AsistenciaListada[]> {
  if (rol === RolUsuario.encargado_seccion) {
    if (!filtros.seccionId) {
      throw new AppError(400, "seccionId es requerido para tu rol.");
    }
    await verificarAccesoSeccion(usuarioId, rol, filtros.seccionId);
  }

  const filtroFecha = filtros.fecha
    ? aFechaUTC(filtros.fecha)
    : filtros.fechaInicio || filtros.fechaFin
      ? {
          ...(filtros.fechaInicio ? { gte: aFechaUTC(filtros.fechaInicio) } : {}),
          ...(filtros.fechaFin ? { lte: aFechaUTC(filtros.fechaFin) } : {}),
        }
      : undefined;

  const registros = await prisma.asistenciaDiaria.findMany({
    where: {
      ...(filtroFecha ? { fecha: filtroFecha } : {}),
      ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
      ...(filtros.trabajadorId ? { trabajadorId: filtros.trabajadorId } : {}),
      ...(filtros.turno ? { turno: filtros.turno } : {}),
      ...(filtros.categoria ? { trabajador: { categoria: filtros.categoria } } : {}),
    },
    include: {
      trabajador: { select: { nombreCompleto: true, categoria: true, huellaRegistrada: true } },
      seccion: { select: { nombre: true, tramoUbicacion: true, obra: { select: { nombre: true } }, encargados: { select: { id: true, username: true, trabajador: { select: { nombreCompleto: true, categoria: true } } } }, horario: { select: { nombre: true } } } },
    },
    orderBy: [{ fecha: "desc" }, { hora: "desc" }],
  });

  return registros.map(({ trabajador, seccion, ...resto }) => ({
    ...resto,
    trabajadorNombre: trabajador.nombreCompleto,
    trabajadorCategoria: trabajador.categoria,
    trabajadorHuellaRegistrada: trabajador.huellaRegistrada,
    seccionNombre: seccion.nombre,
    seccionTramoUbicacion: seccion.tramoUbicacion,
    seccionResponsables: seccion.encargados.map((encargado) => ({ id: encargado.id, username: encargado.username, trabajadorNombre: encargado.trabajador?.nombreCompleto ?? null, trabajadorCategoria: encargado.trabajador?.categoria ?? null })),
    obraNombre: seccion.obra.nombre,
    horarioNombre: seccion.horario?.nombre ?? null,
  }));
}

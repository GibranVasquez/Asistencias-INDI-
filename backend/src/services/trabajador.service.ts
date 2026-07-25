import { Prisma, Trabajador, TrabajadorEstatus, TrabajadorTipo } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosAltaTrabajador {
  nombreCompleto: string;
  categoria: string;
  jefeInmediato: string;
  tipo?: TrabajadorTipo;
  fechaIngreso?: string | null; // YYYY-MM-DD
  sueldoBase?: number | null;
  banco?: string | null;
  clabe?: string | null;
  cuentaBancaria?: string | null;
  infonavitPlazoMeses?: number | null;
  infonavitMontoPorPeriodo?: number | null;
  huellaRegistrada?: boolean;
  rostroRegistrado?: boolean;
  // PIN con el que esta persona se enroló en un lector ADMS (ZKTeco
  // MB10-VL de oficina) — ver adms.service.ts. RH lo captura a mano para
  // que coincida con lo que el equipo reporta.
  numeroChecador?: number | null;
}

export interface DatosEdicionTrabajador extends Partial<DatosAltaTrabajador> {
  estatus?: TrabajadorEstatus;
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

function datosAltaParaPrisma(datos: DatosAltaTrabajador): Prisma.TrabajadorCreateInput {
  return {
    nombreCompleto: datos.nombreCompleto,
    categoria: datos.categoria,
    jefeInmediato: datos.jefeInmediato,
    tipo: datos.tipo ?? TrabajadorTipo.empleado,
    fechaIngreso: datos.fechaIngreso ? aFechaUTC(datos.fechaIngreso) : null,
    sueldoBase: datos.sueldoBase != null ? new Prisma.Decimal(datos.sueldoBase) : null,
    banco: datos.banco ?? null,
    clabe: datos.clabe ?? null,
    cuentaBancaria: datos.cuentaBancaria ?? null,
    infonavitPlazoMeses: datos.infonavitPlazoMeses ?? null,
    infonavitMontoPorPeriodo:
      datos.infonavitMontoPorPeriodo != null ? new Prisma.Decimal(datos.infonavitMontoPorPeriodo) : null,
    huellaRegistrada: datos.huellaRegistrada ?? false,
    rostroRegistrado: datos.rostroRegistrado ?? false,
    numeroChecador: datos.numeroChecador ?? null,
  };
}

/**
 * Actualización parcial: solo se tocan las claves presentes en `datos`, para
 * que RH pueda ir completando sueldoBase/banco/clabe/fechaIngreso sin tener
 * que reenviar el registro completo cada vez.
 */
function datosEdicionParaPrisma(datos: DatosEdicionTrabajador): Prisma.TrabajadorUpdateInput {
  const data: Prisma.TrabajadorUpdateInput = {};

  if (datos.nombreCompleto !== undefined) data.nombreCompleto = datos.nombreCompleto;
  if (datos.categoria !== undefined) data.categoria = datos.categoria;
  if (datos.jefeInmediato !== undefined) data.jefeInmediato = datos.jefeInmediato;
  if (datos.tipo !== undefined) data.tipo = datos.tipo;
  if (datos.estatus !== undefined) data.estatus = datos.estatus;
  if (datos.fechaIngreso !== undefined) data.fechaIngreso = datos.fechaIngreso ? aFechaUTC(datos.fechaIngreso) : null;
  if (datos.sueldoBase !== undefined) {
    data.sueldoBase = datos.sueldoBase != null ? new Prisma.Decimal(datos.sueldoBase) : null;
  }
  if (datos.banco !== undefined) data.banco = datos.banco;
  if (datos.clabe !== undefined) data.clabe = datos.clabe;
  if (datos.cuentaBancaria !== undefined) data.cuentaBancaria = datos.cuentaBancaria;
  if (datos.infonavitPlazoMeses !== undefined) data.infonavitPlazoMeses = datos.infonavitPlazoMeses;
  if (datos.infonavitMontoPorPeriodo !== undefined) {
    data.infonavitMontoPorPeriodo =
      datos.infonavitMontoPorPeriodo != null ? new Prisma.Decimal(datos.infonavitMontoPorPeriodo) : null;
  }
  if (datos.huellaRegistrada !== undefined) data.huellaRegistrada = datos.huellaRegistrada;
  if (datos.rostroRegistrado !== undefined) data.rostroRegistrado = datos.rostroRegistrado;
  if (datos.numeroChecador !== undefined) data.numeroChecador = datos.numeroChecador;

  return data;
}

async function verificarNumeroCheckadorDisponible(numeroChecador: number | null | undefined, idAExcluir?: string): Promise<void> {
  if (numeroChecador == null) return;
  const existente = await prisma.trabajador.findUnique({ where: { numeroChecador } });
  if (existente && existente.id !== idAExcluir) {
    throw new AppError(409, "Ya existe otro trabajador con ese número de checador.");
  }
}

export async function crearTrabajador(usuarioActorId: string, datos: DatosAltaTrabajador): Promise<Trabajador> {
  await verificarNumeroCheckadorDisponible(datos.numeroChecador);

  return prisma.$transaction(async (tx) => {
    const trabajador = await tx.trabajador.create({ data: datosAltaParaPrisma(datos) });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "crear_trabajador",
        entidad: "Trabajador",
        entidadId: trabajador.id,
        detalle: { nombreCompleto: trabajador.nombreCompleto, categoria: trabajador.categoria },
      },
    });

    return trabajador;
  });
}

export async function listarTrabajadores(): Promise<Trabajador[]> {
  return prisma.trabajador.findMany({ orderBy: { nombreCompleto: "asc" } });
}

export interface TrabajadorBasico {
  id: string;
  nombreCompleto: string;
  estatus: TrabajadorEstatus;
}

// Subconjunto de solo lectura (sin sueldo/banco/clabe/etc.) para roles que
// necesitan resolver nombres o buscar un trabajador (ej. encargado_seccion
// armando una asignación diaria) sin acceso al catálogo completo de RH.
export async function listarTrabajadoresBasico(): Promise<TrabajadorBasico[]> {
  return prisma.trabajador.findMany({
    select: { id: true, nombreCompleto: true, estatus: true },
    orderBy: { nombreCompleto: "asc" },
  });
}

export async function obtenerTrabajador(id: string): Promise<Trabajador> {
  const trabajador = await prisma.trabajador.findUnique({ where: { id } });
  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }
  return trabajador;
}

// El detalle del audit log solo registra los NOMBRES de los campos que
// cambiaron, nunca sus valores — administrador tiene acceso a /auditoria
// pero no a /trabajadores (exclusivo de rh), así que el trail de auditoría
// no debe filtrar sueldo/banco/clabe (mismo criterio ya usado en
// resetear_password, que solo loguea {username}).
export async function editarTrabajador(
  usuarioActorId: string,
  id: string,
  datos: DatosEdicionTrabajador
): Promise<Trabajador> {
  await obtenerTrabajador(id);
  await verificarNumeroCheckadorDisponible(datos.numeroChecador, id);

  const camposEditados = Object.keys(datos).filter((k) => (datos as Record<string, unknown>)[k] !== undefined);

  return prisma.$transaction(async (tx) => {
    const trabajador = await tx.trabajador.update({ where: { id }, data: datosEdicionParaPrisma(datos) });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_trabajador",
        entidad: "Trabajador",
        entidadId: id,
        detalle: { camposEditados },
      },
    });

    return trabajador;
  });
}

export async function borrarTrabajador(usuarioActorId: string, id: string): Promise<void> {
  const trabajador = await obtenerTrabajador(id);

  const [tieneUsuario, asistencias, movimientos, nominas] = await Promise.all([
    prisma.usuario.count({ where: { trabajadorId: id } }),
    prisma.asistenciaDiaria.count({ where: { trabajadorId: id } }),
    prisma.movimientoTrabajador.count({ where: { trabajadorId: id } }),
    prisma.nominaSemanal.count({ where: { trabajadorId: id } }),
  ]);

  if (tieneUsuario > 0 || asistencias > 0 || movimientos > 0 || nominas > 0) {
    throw new AppError(
      409,
      "No se puede borrar: el trabajador está en uso (tiene cuenta de usuario, asistencias, movimientos o nóminas asociadas). Da de baja su estatus en vez de borrarlo."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.trabajador.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "borrar_trabajador",
        entidad: "Trabajador",
        entidadId: id,
        detalle: { nombreCompleto: trabajador.nombreCompleto },
      },
    });
  });
}

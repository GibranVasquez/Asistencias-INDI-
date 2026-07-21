import { MovimientoTrabajador } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosAltaMovimiento {
  trabajadorId: string;
  tipoMovimientoId: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin?: string | null;
  nota?: string | null;
}

export interface DatosEdicionMovimiento {
  fechaInicio: string;
  fechaFin?: string | null;
  nota?: string | null;
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

export async function crearMovimiento(datos: DatosAltaMovimiento): Promise<MovimientoTrabajador> {
  const [trabajador, tipoMovimiento] = await Promise.all([
    prisma.trabajador.findUnique({ where: { id: datos.trabajadorId } }),
    prisma.tipoMovimiento.findUnique({ where: { id: datos.tipoMovimientoId } }),
  ]);
  if (!trabajador) {
    throw new AppError(404, "El trabajador indicado no existe.");
  }
  if (!tipoMovimiento) {
    throw new AppError(404, "El tipo de movimiento indicado no existe.");
  }

  return prisma.movimientoTrabajador.create({
    data: {
      trabajadorId: datos.trabajadorId,
      tipoMovimientoId: datos.tipoMovimientoId,
      fechaInicio: aFechaUTC(datos.fechaInicio),
      fechaFin: datos.fechaFin ? aFechaUTC(datos.fechaFin) : null,
      nota: datos.nota ?? null,
    },
  });
}

export async function listarMovimientos(trabajadorId?: string): Promise<MovimientoTrabajador[]> {
  return prisma.movimientoTrabajador.findMany({
    where: trabajadorId ? { trabajadorId } : undefined,
    orderBy: { fechaInicio: "desc" },
  });
}

export async function obtenerMovimiento(id: string): Promise<MovimientoTrabajador> {
  const movimiento = await prisma.movimientoTrabajador.findUnique({ where: { id } });
  if (!movimiento) {
    throw new AppError(404, "Movimiento no encontrado.");
  }
  return movimiento;
}

// trabajadorId y tipoMovimientoId no se pueden editar: si el movimiento se
// capturó mal, se borra y se crea uno nuevo, no se reasigna a otro trabajador/tipo.
export async function editarMovimiento(id: string, datos: DatosEdicionMovimiento): Promise<MovimientoTrabajador> {
  await obtenerMovimiento(id);

  return prisma.movimientoTrabajador.update({
    where: { id },
    data: {
      fechaInicio: aFechaUTC(datos.fechaInicio),
      fechaFin: datos.fechaFin ? aFechaUTC(datos.fechaFin) : null,
      nota: datos.nota ?? null,
    },
  });
}

export async function borrarMovimiento(id: string): Promise<void> {
  await obtenerMovimiento(id);
  await prisma.movimientoTrabajador.delete({ where: { id } });
}

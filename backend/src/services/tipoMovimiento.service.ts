import { TipoMovimiento } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosTipoMovimiento {
  nombre: string;
  cuentaComoDiaTrabajado: boolean;
  esInformativo: boolean;
  requiereAutorizacion: boolean;
}

export async function crearTipoMovimiento(datos: DatosTipoMovimiento): Promise<TipoMovimiento> {
  const existente = await prisma.tipoMovimiento.findUnique({ where: { nombre: datos.nombre } });
  if (existente) {
    throw new AppError(409, "Ya existe un tipo de movimiento con ese nombre.");
  }

  return prisma.tipoMovimiento.create({ data: datos });
}

export async function listarTiposMovimiento(): Promise<TipoMovimiento[]> {
  return prisma.tipoMovimiento.findMany({ orderBy: { nombre: "asc" } });
}

export async function obtenerTipoMovimiento(id: string): Promise<TipoMovimiento> {
  const tipo = await prisma.tipoMovimiento.findUnique({ where: { id } });
  if (!tipo) {
    throw new AppError(404, "Tipo de movimiento no encontrado.");
  }
  return tipo;
}

export async function editarTipoMovimiento(id: string, datos: DatosTipoMovimiento): Promise<TipoMovimiento> {
  await obtenerTipoMovimiento(id);

  const conflicto = await prisma.tipoMovimiento.findUnique({ where: { nombre: datos.nombre } });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe un tipo de movimiento con ese nombre.");
  }

  return prisma.tipoMovimiento.update({ where: { id }, data: datos });
}

export async function borrarTipoMovimiento(id: string): Promise<void> {
  await obtenerTipoMovimiento(id);

  const enUso = await prisma.movimientoTrabajador.count({ where: { tipoMovimientoId: id } });
  if (enUso > 0) {
    throw new AppError(409, "No se puede borrar: hay movimientos de trabajador que usan este tipo.");
  }

  await prisma.tipoMovimiento.delete({ where: { id } });
}

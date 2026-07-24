import { TipoMovimiento } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosTipoMovimiento {
  nombre: string;
  cuentaComoDiaTrabajado: boolean;
  esInformativo: boolean;
  requiereAutorizacion: boolean;
}

export async function crearTipoMovimiento(
  usuarioActorId: string,
  datos: DatosTipoMovimiento
): Promise<TipoMovimiento> {
  const existente = await prisma.tipoMovimiento.findUnique({ where: { nombre: datos.nombre } });
  if (existente) {
    throw new AppError(409, "Ya existe un tipo de movimiento con ese nombre.");
  }

  return prisma.$transaction(async (tx) => {
    const tipo = await tx.tipoMovimiento.create({ data: datos });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "crear_tipo_movimiento",
        entidad: "TipoMovimiento",
        entidadId: tipo.id,
        detalle: { nombre: tipo.nombre },
      },
    });

    return tipo;
  });
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

export async function editarTipoMovimiento(
  usuarioActorId: string,
  id: string,
  datos: DatosTipoMovimiento
): Promise<TipoMovimiento> {
  await obtenerTipoMovimiento(id);

  const conflicto = await prisma.tipoMovimiento.findUnique({ where: { nombre: datos.nombre } });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe un tipo de movimiento con ese nombre.");
  }

  return prisma.$transaction(async (tx) => {
    const tipo = await tx.tipoMovimiento.update({ where: { id }, data: datos });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_tipo_movimiento",
        entidad: "TipoMovimiento",
        entidadId: id,
        detalle: { nombre: tipo.nombre },
      },
    });

    return tipo;
  });
}

export async function borrarTipoMovimiento(usuarioActorId: string, id: string): Promise<void> {
  const tipo = await obtenerTipoMovimiento(id);

  const enUso = await prisma.movimientoTrabajador.count({ where: { tipoMovimientoId: id } });
  if (enUso > 0) {
    throw new AppError(409, "No se puede borrar: hay movimientos de trabajador que usan este tipo.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tipoMovimiento.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "borrar_tipo_movimiento",
        entidad: "TipoMovimiento",
        entidadId: id,
        detalle: { nombre: tipo.nombre },
      },
    });
  });
}

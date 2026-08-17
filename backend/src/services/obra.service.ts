import { Obra } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export async function obtenerObraActual(): Promise<Pick<Obra, "id" | "nombre" | "creadoEn">> {
  const obra = await prisma.obra.findFirst({ orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, creadoEn: true } });
  if (!obra) throw new AppError(404, "No hay una obra configurada.");
  return obra;
}

export async function editarObraActual(usuarioActorId: string, nombre: string): Promise<Pick<Obra, "id" | "nombre" | "creadoEn">> {
  const obra = await prisma.obra.findFirst({ orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, creadoEn: true } });
  if (!obra) throw new AppError(404, "No hay una obra configurada.");

  const actualizada = await prisma.$transaction(async (tx) => {
    const resultado = await tx.obra.update({ where: { id: obra.id }, data: { nombre }, select: { id: true, nombre: true, creadoEn: true } });
    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_obra",
        entidad: "Obra",
        entidadId: obra.id,
        detalle: { nombre },
      },
    });
    return resultado;
  });
  return actualizada;
}

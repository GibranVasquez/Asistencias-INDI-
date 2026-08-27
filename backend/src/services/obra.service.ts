import { Obra } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export async function obtenerObraActual(): Promise<Pick<Obra, "id" | "nombre" | "creadoEn" | "timezoneObra">> {
  const obra = await prisma.obra.findFirst({ orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, creadoEn: true, timezoneObra: true } });
  if (!obra) throw new AppError(404, "No hay una obra configurada.");
  return obra;
}

export async function listarObras(): Promise<Pick<Obra, "id" | "nombre" | "creadoEn" | "timezoneObra">[]> {
  return prisma.obra.findMany({
    orderBy: { creadoEn: "asc" },
    select: { id: true, nombre: true, creadoEn: true, timezoneObra: true },
  });
}

export async function editarObraActual(usuarioActorId: string, nombre: string, timezoneObra?: string): Promise<Pick<Obra, "id" | "nombre" | "creadoEn" | "timezoneObra">> {
  const obra = await prisma.obra.findFirst({ orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true, creadoEn: true, timezoneObra: true } });
  if (!obra) throw new AppError(404, "No hay una obra configurada.");

  const actualizada = await prisma.$transaction(async (tx) => {
    const resultado = await tx.obra.update({ where: { id: obra.id }, data: { nombre, ...(timezoneObra !== undefined ? { timezoneObra } : {}) }, select: { id: true, nombre: true, creadoEn: true, timezoneObra: true } });
    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_obra",
        entidad: "Obra",
        entidadId: obra.id,
        detalle: { nombre, ...(timezoneObra !== undefined ? { timezoneObraAnterior: obra.timezoneObra, timezoneObraNueva: timezoneObra } : {}) },
      },
    });
    return resultado;
  });
  return actualizada;
}

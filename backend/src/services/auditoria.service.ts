import { prisma } from "../utils/prisma";

export interface FiltrosAuditoria {
  entidad?: string;
  entidadId?: string;
}

export interface AuditoriaListada {
  id: string;
  actorUsername: string;
  accion: string;
  entidad: string;
  entidadId: string;
  fecha: string;
  detalle: unknown;
}

// Solo lectura, rol=administrador (ver rutas). AuditLog.usuarioId es quien
// EJECUTÓ la acción (el actor), no la entidad afectada — se denormaliza su
// username aquí porque no hay otro endpoint que se lo resuelva al cliente.
export async function listarAuditoria(filtros: FiltrosAuditoria): Promise<AuditoriaListada[]> {
  const registros = await prisma.auditLog.findMany({
    where: {
      entidad: filtros.entidad,
      entidadId: filtros.entidadId,
    },
    include: { usuario: { select: { username: true } } },
    orderBy: { fecha: "desc" },
  });

  return registros.map((r) => ({
    id: r.id,
    actorUsername: r.usuario.username,
    accion: r.accion,
    entidad: r.entidad,
    entidadId: r.entidadId,
    fecha: r.fecha.toISOString(),
    detalle: r.detalle,
  }));
}

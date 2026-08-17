import { apiClient } from "@/core/api/client";

export interface RegistroAuditoria {
  id: string;
  actorUsername: string;
  accion: string;
  entidad: string;
  entidadId: string;
  fecha: string;
  detalle: string[];
}

export interface PaginaAuditoria { registros: RegistroAuditoria[]; total: number; pagina: number; limite: number }

export function listarAuditoria(token: string, filtros: { entidad?: string; entidadId?: string; accion?: string; actor?: string; pagina?: number; limite?: number } = {}) {
  const params = new URLSearchParams();
  if (filtros.entidad) params.set("entidad", filtros.entidad);
  if (filtros.entidadId) params.set("entidadId", filtros.entidadId);
  if (filtros.accion) params.set("accion", filtros.accion);
  if (filtros.actor) params.set("actor", filtros.actor);
  if (filtros.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros.limite) params.set("limite", String(filtros.limite));
  const qs = params.toString();
  return apiClient.get<PaginaAuditoria>(`/auditoria${qs ? `?${qs}` : ""}`, token);
}

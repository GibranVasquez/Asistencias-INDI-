import { apiClient } from "./client";

export interface RegistroAuditoria {
  id: string;
  actorUsername: string;
  accion: string;
  entidad: string;
  entidadId: string;
  fecha: string;
  detalle: unknown;
}

export function listarAuditoria(token: string, filtros: { entidad?: string; entidadId?: string } = {}) {
  const params = new URLSearchParams();
  if (filtros.entidad) params.set("entidad", filtros.entidad);
  if (filtros.entidadId) params.set("entidadId", filtros.entidadId);
  const qs = params.toString();
  return apiClient.get<{ registros: RegistroAuditoria[] }>(`/auditoria${qs ? `?${qs}` : ""}`, token);
}

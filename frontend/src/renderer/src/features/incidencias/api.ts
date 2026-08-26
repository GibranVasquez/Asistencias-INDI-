import { apiClient } from "@/core/api/client";

export interface Incidencia {
  id: string; tipo: "ADMS_NO_RECONCILIADO"; estado: "pendiente" | "reconciliada";
  fechaEvento: string; fechaMarcacion: string | null; horaMarcacion: string | null; detectadoEn: string; identificadorDispositivo: string;
  terminal: string; ubicacion: string; obraId: string | null; obraNombre: string | null;
  asistenciaId: string | null; reconciliadoEn: string | null;
}
export interface PaginaIncidencias { items: Incidencia[]; total: number; pagina: number; limite: number }
export function listarIncidencias(token: string, filtros: { busqueda?: string; pagina?: number; limite?: number } = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor !== undefined && valor !== "") params.set(clave, String(valor));
  const qs = params.toString();
  return apiClient.get<PaginaIncidencias>(`/incidencias${qs ? `?${qs}` : ""}`, token);
}

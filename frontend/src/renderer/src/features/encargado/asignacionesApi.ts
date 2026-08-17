import { apiClient } from "@/core/api/client";

export interface TrabajadorResumen {
  trabajadorId: string;
  nombreCompleto: string;
}

export interface ResumenSeccionHoy {
  fecha: string;
  seccionId: string;
  presentes: (TrabajadorResumen & { hora: string; asignado: boolean })[];
  sinAsignacion: boolean;
  totalAsignado: number | null;
  ausentes: TrabajadorResumen[] | null;
}

export function obtenerResumenHoy(token: string, seccionId: string) {
  return apiClient.get<ResumenSeccionHoy>(`/secciones/${seccionId}/hoy`, token);
}

export interface SugerenciaAsignacion {
  fechaSugerida: string;
  trabajadorIds: string[];
  trabajadores: { id: string; nombreCompleto: string }[];
}

export function obtenerSugerencia(token: string, seccionId: string, fecha: string) {
  return apiClient.get<SugerenciaAsignacion>(
    `/asignaciones/sugerencia?seccionId=${encodeURIComponent(seccionId)}&fecha=${encodeURIComponent(fecha)}`,
    token
  );
}

export interface DatosAsignacion {
  seccionId: string;
  fecha: string;
  trabajadorIds: string[];
}

export interface TrabajadorMovido {
  trabajadorId: string;
  trabajadorNombre: string;
  seccionAnteriorId: string;
  seccionAnteriorNombre: string;
}

export interface ResultadoAsignacion {
  asignaciones: unknown[];
  movidos: TrabajadorMovido[];
}

export function asignarSeccionDelDia(token: string, datos: DatosAsignacion) {
  return apiClient.post<ResultadoAsignacion>("/asignaciones", datos, token);
}

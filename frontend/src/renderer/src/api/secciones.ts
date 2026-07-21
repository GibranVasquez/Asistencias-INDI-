import { apiClient } from "./client";

export interface Seccion {
  id: string;
  obraId: string;
  nombre: string;
  horarioId: string | null;
}

export function listarSecciones(token: string) {
  return apiClient.get<{ secciones: Seccion[] }>("/secciones", token);
}

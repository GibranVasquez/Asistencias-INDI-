import { apiClient } from "@/core/api/client";

export interface ObraActual {
  id: string;
  nombre: string;
  creadoEn: string;
}

export function obtenerObraActual(token: string) {
  return apiClient.get<{ obra: ObraActual }>("/obras/actual", token);
}

export function editarObraActual(token: string, nombre: string) {
  return apiClient.patch<{ obra: ObraActual }>("/obras/actual", { nombre }, token);
}

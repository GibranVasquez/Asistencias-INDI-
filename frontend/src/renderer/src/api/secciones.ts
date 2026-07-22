import { apiClient } from "./client";

export interface Seccion {
  id: string;
  obraId: string;
  nombre: string;
  horarioId: string | null;
  creadoEn: string;
  // Presente solo en GET /secciones (listarSecciones) — no en el /:id puntual.
  encargados?: { id: string; username: string }[];
}

export interface DatosAltaSeccion {
  obraId: string;
  nombre: string;
  horarioId?: string | null;
  encargadoIds?: string[];
}

export interface DatosEdicionSeccion {
  nombre: string;
  // undefined = no tocar; null = quitar el horario; string = asignar ese.
  horarioId?: string | null;
  // undefined = no tocar los encargados; array (incluso vacío) = reemplaza.
  encargadoIds?: string[];
}

export function listarSecciones(token: string) {
  return apiClient.get<{ secciones: Seccion[] }>("/secciones", token);
}

export function crearSeccion(token: string, datos: DatosAltaSeccion) {
  return apiClient.post<{ seccion: Seccion }>("/secciones", datos, token);
}

export function editarSeccion(token: string, id: string, datos: DatosEdicionSeccion) {
  return apiClient.patch<{ seccion: Seccion }>(`/secciones/${id}`, datos, token);
}

export function borrarSeccion(token: string, id: string) {
  return apiClient.del<void>(`/secciones/${id}`, token);
}

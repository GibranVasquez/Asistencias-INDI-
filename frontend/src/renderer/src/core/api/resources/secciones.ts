import { apiClient } from "@/core/api/client";

export interface Seccion {
  id: string;
  obraId: string;
  nombre: string;
  horarioId: string | null;
  tramoUbicacion: string | null;
  creadoEn: string;
  obra?: { nombre: string };
  // Presente solo en GET /secciones (listarSecciones) — no en el /:id puntual.
  encargados?: { id: string; username: string; trabajadorId: string | null; trabajadorNombre?: string | null; trabajadorCategoria?: string | null }[];
  responsablesTramo?: ResponsableTramo[];
}

export interface ResponsableTramo {
  id: string;
  nombreCompleto: string;
  categoria: string;
  estatus: "activo" | "baja";
}

export interface DatosAltaSeccion {
  obraId: string;
  nombre: string;
  horarioId?: string | null;
  encargadoIds?: string[];
  tramoUbicacion?: string | null;
}

export interface DatosEdicionSeccion {
  nombre: string;
  // undefined = no tocar; null = quitar el horario; string = asignar ese.
  horarioId?: string | null;
  // undefined = no tocar los encargados; array (incluso vacío) = reemplaza.
  encargadoIds?: string[];
  tramoUbicacion?: string | null;
}

export function listarSecciones(token: string, obraId?: string) {
  const ruta = obraId ? `/secciones?obraId=${encodeURIComponent(obraId)}` : "/secciones";
  return apiClient.get<{ secciones: Seccion[] }>(ruta, token);
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

export function listarResponsablesTramo(token: string, seccionId: string) {
  return apiClient.get<{ responsablesTramo: ResponsableTramo[] }>(`/secciones/${seccionId}/responsables`, token);
}

export function listarTrabajadoresResponsables(token: string) {
  return apiClient.get<{ trabajadores: ResponsableTramo[] }>("/secciones/responsables/elegibles", token);
}

export function asignarResponsableTramo(token: string, seccionId: string, trabajadorId: string) {
  return apiClient.post<{ responsable: ResponsableTramo }>(`/secciones/${seccionId}/responsables`, { trabajadorId }, token);
}

export function retirarResponsableTramo(token: string, seccionId: string, trabajadorId: string) {
  return apiClient.del<void>(`/secciones/${seccionId}/responsables/${trabajadorId}`, token);
}

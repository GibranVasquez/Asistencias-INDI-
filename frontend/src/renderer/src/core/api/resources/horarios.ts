import { apiClient } from "@/core/api/client";

export interface Horario {
  id: string;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  recesoInicio: string | null;
  recesoFin: string | null;
  creadoEn: string;
  // Presente solo en GET /horarios (listarHorarios), para que RH vea el
  // impacto antes de editar/borrar uno — no en el /:id puntual (sin uso aquí).
  secciones?: { id: string; nombre: string }[];
}

export interface DatosHorario {
  nombre: string;
  horaEntrada: string; // HH:MM
  horaSalida: string;
  toleranciaMinutos: number;
  recesoInicio?: string | null;
  recesoFin?: string | null;
}

export function listarHorarios(token: string) {
  return apiClient.get<{ horarios: Horario[] }>("/horarios", token);
}

export function crearHorario(token: string, datos: DatosHorario) {
  return apiClient.post<{ horario: Horario }>("/horarios", datos, token);
}

export function editarHorario(token: string, id: string, datos: DatosHorario) {
  return apiClient.patch<{ horario: Horario }>(`/horarios/${id}`, datos, token);
}

export function borrarHorario(token: string, id: string) {
  return apiClient.del<void>(`/horarios/${id}`, token);
}

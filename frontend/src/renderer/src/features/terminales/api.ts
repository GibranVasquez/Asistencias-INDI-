import { apiClient } from "@/core/api/client";

export interface Terminal {
  id: string;
  username: string;
  tipo: string;
  ubicacion: string;
  numeroSerie: string | null;
  obraId: string | null;
  activo: boolean;
  estadoConexion: string;
  ultimaSincronizacion: string | null;
}

export function listarTerminales(token: string) {
  return apiClient.get<{ terminales: Terminal[] }>("/terminales", token);
}

export interface DatosAltaTerminal {
  username: string;
  // No requerido para tipo="adms": el backend genera una password aleatoria
  // en ese caso (ver terminal.service.ts) — ese tipo nunca inicia sesión.
  password?: string;
  tipo: string;
  ubicacion: string;
  numeroSerie?: string | null;
  obraId?: string | null;
}

export function crearTerminal(token: string, datos: DatosAltaTerminal) {
  return apiClient.post<{ terminal: Terminal }>("/terminales", datos, token);
}

export interface DatosEdicionTerminal {
  ubicacion?: string;
  numeroSerie?: string | null;
  activo?: boolean;
  obraId?: string | null;
}

export function editarTerminal(token: string, id: string, datos: DatosEdicionTerminal) {
  return apiClient.patch<{ terminal: Terminal }>(`/terminales/${id}`, datos, token);
}

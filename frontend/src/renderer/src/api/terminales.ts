import { apiClient } from "./client";

export interface Terminal {
  id: string;
  username: string;
  tipo: string;
  ubicacion: string;
  numeroSerie: string | null;
  activo: boolean;
  estadoConexion: string;
  ultimaSincronizacion: string | null;
}

export function listarTerminales(token: string) {
  return apiClient.get<{ terminales: Terminal[] }>("/terminales", token);
}

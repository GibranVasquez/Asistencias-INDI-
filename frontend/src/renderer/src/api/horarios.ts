import { apiClient } from "./client";

export interface Horario {
  id: string;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
}

export function listarHorarios(token: string) {
  return apiClient.get<{ horarios: Horario[] }>("/horarios", token);
}

import { apiClient } from "@/core/api/client";

export interface TarifaHoraExtra {
  id: string;
  valor: string; // Decimal serializado como string
  vigenteDesde: string;
  creadoEn: string;
}

export interface DatosTarifaHoraExtra {
  valor: number;
  vigenteDesde: string; // YYYY-MM-DD
}

// Solo lectura + alta en esta pantalla: es un historial append-only (editar/
// borrar una tarifa ya usada en una nómina generada rechaza con 409 en el
// backend), no un valor único editable — por eso no se expone PATCH/DELETE
// aquí, solo listar (ordenado por vigenteDesde desc) + crear.
export function listarTarifasHoraExtra(token: string) {
  return apiClient.get<{ tarifas: TarifaHoraExtra[] }>("/tarifas-hora-extra", token);
}

export function crearTarifaHoraExtra(token: string, datos: DatosTarifaHoraExtra) {
  return apiClient.post<{ tarifa: TarifaHoraExtra }>("/tarifas-hora-extra", datos, token);
}

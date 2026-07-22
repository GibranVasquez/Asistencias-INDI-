import { apiClient } from "./client";

export interface TipoMovimiento {
  id: string;
  nombre: string;
  cuentaComoDiaTrabajado: boolean;
  esInformativo: boolean;
  requiereAutorizacion: boolean;
  creadoEn: string;
}

export interface DatosTipoMovimiento {
  nombre: string;
  cuentaComoDiaTrabajado: boolean;
  esInformativo: boolean;
  requiereAutorizacion: boolean;
}

export function listarTiposMovimiento(token: string) {
  return apiClient.get<{ tiposMovimiento: TipoMovimiento[] }>("/tipos-movimiento", token);
}

export function crearTipoMovimiento(token: string, datos: DatosTipoMovimiento) {
  return apiClient.post<{ tipoMovimiento: TipoMovimiento }>("/tipos-movimiento", datos, token);
}

export function editarTipoMovimiento(token: string, id: string, datos: DatosTipoMovimiento) {
  return apiClient.patch<{ tipoMovimiento: TipoMovimiento }>(`/tipos-movimiento/${id}`, datos, token);
}

export function borrarTipoMovimiento(token: string, id: string) {
  return apiClient.del<void>(`/tipos-movimiento/${id}`, token);
}

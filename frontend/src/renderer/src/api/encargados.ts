import { apiClient } from "./client";

export interface EncargadoBasico {
  id: string;
  username: string;
}

// Subconjunto mínimo (rol=encargado_seccion) accesible a rh, para el
// multi-select de encargados en Secciones — GET /usuarios completo sigue
// siendo exclusivo de administrador.
export function listarEncargados(token: string) {
  return apiClient.get<{ usuarios: EncargadoBasico[] }>("/usuarios/encargados", token);
}

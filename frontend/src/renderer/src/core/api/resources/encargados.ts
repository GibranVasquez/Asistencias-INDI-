import { apiClient } from "@/core/api/client";

export interface EncargadoBasico {
  id: string;
  username: string;
  trabajadorId: string | null;
  trabajadorNombre: string | null;
  trabajadorCategoria: string | null;
}

// Subconjunto mínimo (rol=encargado_seccion) accesible a rh, para el
// multi-select de encargados en Secciones — GET /usuarios completo sigue
// siendo exclusivo de administrador.
export function listarEncargados(token: string) {
  return apiClient.get<{ usuarios: EncargadoBasico[] }>("/usuarios/encargados", token);
}

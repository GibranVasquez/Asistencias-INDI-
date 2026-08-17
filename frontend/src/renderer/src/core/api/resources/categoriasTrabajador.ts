import { apiClient } from "@/core/api/client";

export interface CategoriaTrabajador {
  id: string;
  nombre: string;
  sueldoBaseDefault: string | null; // Decimal serializado como string
  esDefault: boolean;
  creadoEn: string;
}

export interface DatosCategoriaTrabajador {
  nombre: string;
  sueldoBaseDefault: number | null;
  esDefault: boolean;
}

export function listarCategoriasTrabajador(token: string) {
  return apiClient.get<{ categorias: CategoriaTrabajador[] }>("/categorias-trabajador", token);
}

export function crearCategoriaTrabajador(token: string, datos: DatosCategoriaTrabajador) {
  return apiClient.post<{ categoria: CategoriaTrabajador }>("/categorias-trabajador", datos, token);
}

export function editarCategoriaTrabajador(token: string, id: string, datos: DatosCategoriaTrabajador) {
  return apiClient.patch<{ categoria: CategoriaTrabajador }>(`/categorias-trabajador/${id}`, datos, token);
}

export function borrarCategoriaTrabajador(token: string, id: string) {
  return apiClient.del<void>(`/categorias-trabajador/${id}`, token);
}

export function aplicarSueldoATodosDeCategoria(token: string, id: string, nuevoSueldoBase: number) {
  return apiClient.post<{ afectados: number }>(`/categorias-trabajador/${id}/aplicar-a-todos`, { nuevoSueldoBase }, token);
}

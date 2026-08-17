import { apiClient } from "@/core/api/client";
import { RolUsuario } from "@/features/auth/api";

// "trabajador" queda fuera a propósito: no tiene ningún permitirRoles que lo
// use en toda la API (verificado 2026-07-22) — una cuenta así quedaría
// autenticada sin acceso a nada. El enum de Prisma lo sigue teniendo (no se
// tocó el schema), pero esta pantalla es la única forma real de crear
// cuentas y no debe ofrecerlo.
export const ROLES_CREABLES: Exclude<RolUsuario, "trabajador">[] = ["recepcion", "encargado_seccion", "rh", "administrador"];

export interface UsuarioListado {
  id: string;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  trabajadorId: string | null;
  creadoEn: string;
  trabajadorNombre: string | null;
  seccionesAsignadas: { id: string; nombre: string }[];
}

export function listarUsuarios(token: string) {
  return apiClient.get<{ usuarios: UsuarioListado[] }>("/usuarios", token);
}

export interface DatosAltaUsuario {
  username: string;
  password: string;
  rol: Exclude<RolUsuario, "trabajador">;
  seccionesAsignadas?: string[];
}

export function crearUsuario(token: string, datos: DatosAltaUsuario) {
  return apiClient.post<{ usuario: UsuarioListado }>("/usuarios", datos, token);
}

export function cambiarEstadoUsuario(token: string, id: string, activo: boolean) {
  return apiClient.patch<{ usuario: UsuarioListado }>(`/usuarios/${id}/estado`, { activo }, token);
}

// Deja la cuenta con requiereCambioPassword=true — el usuario debe cambiarla
// por una propia (PATCH /auth/cambiar-password) en su siguiente login.
export function resetearPasswordUsuario(token: string, id: string, passwordTemporal: string) {
  return apiClient.patch<void>(`/usuarios/${id}/password`, { passwordTemporal }, token);
}

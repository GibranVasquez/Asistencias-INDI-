import { apiClient } from "./client";

export type RolUsuario = "trabajador" | "recepcion" | "encargado_seccion" | "rh" | "administrador";

export interface UsuarioPublico {
  id: string;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  trabajadorId: string | null;
  // Solo relevante para encargado_seccion: en qué secciones puede ver/asignar
  // (mismo scoping que ya aplica el backend vía verificarAccesoSeccion).
  // Vacío para el resto de los roles.
  seccionesAsignadas: { id: string; nombre: string }[];
}

export interface TerminalPublico {
  id: string;
  username: string;
  tipo: string;
  ubicacion: string;
  activo: boolean;
  estadoConexion: string;
}

export function login(username: string, password: string) {
  return apiClient.post<{ token: string; usuario: UsuarioPublico }>("/auth/login", { username, password });
}

export function loginTerminal(username: string, password: string) {
  return apiClient.post<{ token: string; terminal: TerminalPublico }>("/auth/login-terminal", {
    username,
    password,
  });
}

export function usuarioActual(token: string) {
  return apiClient.get<{ usuario: UsuarioPublico }>("/auth/usuario-actual", token);
}

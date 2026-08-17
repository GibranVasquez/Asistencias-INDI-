import { ReactNode } from "react";
import { RolUsuario } from "@/features/auth/api";

export type RutaPanel =
  | "dashboard"
  | "asistencias"
  | "trabajadores"
  | "encargado"
  | "nomina"
  | "usuarios"
  | "terminales"
  | "configuracion"
  | "reportes"
  | "incidencias"
  | "auditoria";

export type GrupoNavegacion = "general" | "operacion" | "supervision" | "administracion";

export interface NavegacionItem {
  id: RutaPanel;
  path: `/panel/${string}`;
  label: string;
  group: GrupoNavegacion;
  roles: RolUsuario[];
  icon: ReactNode;
}

export const ETIQUETAS_GRUPO: Record<GrupoNavegacion, string> = {
  general: "General",
  operacion: "Operación",
  supervision: "Supervisión",
  administracion: "Administración",
};

const icono = (children: ReactNode) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

// Fuente única para path, etiqueta, icono, roles, agrupación y orden del
// sidebar. El backend sigue siendo la autoridad de autorización efectiva.
export const NAVEGACION: NavegacionItem[] = [
  { id: "dashboard", path: "/panel/dashboard", label: "Panel principal", group: "general", roles: ["rh", "administrador"], icon: icono(<><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>) },
  { id: "trabajadores", path: "/panel/trabajadores", label: "Trabajadores", group: "operacion", roles: ["rh"], icon: icono(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>) },
  { id: "asistencias", path: "/panel/asistencias", label: "Asistencias", group: "operacion", roles: ["rh", "recepcion"], icon: icono(<><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>) },
  { id: "nomina", path: "/panel/nomina", label: "Nómina RH", group: "operacion", roles: ["rh"], icon: icono(<><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></>) },
  { id: "reportes", path: "/panel/reportes", label: "Reportes", group: "operacion", roles: ["rh"], icon: icono(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>) },
  { id: "encargado", path: "/panel/encargado", label: "Responsable del tramo", group: "operacion", roles: ["rh", "encargado_seccion"], icon: icono(<><path d="m12 2-10 5 10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></>) },
  { id: "incidencias", path: "/panel/incidencias", label: "Incidencias", group: "supervision", roles: ["rh", "administrador"], icon: icono(<><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>) },
  { id: "auditoria", path: "/panel/auditoria", label: "Auditoría", group: "supervision", roles: ["administrador"], icon: icono(<><path d="M3 3v5h5M3.1 13a9 9 0 1 0 2.1-6.2L3 8M12 7v5l3 2"/></>) },
  { id: "usuarios", path: "/panel/usuarios", label: "Usuarios", group: "administracion", roles: ["administrador"], icon: icono(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>) },
  { id: "terminales", path: "/panel/terminales", label: "Terminales", group: "administracion", roles: ["administrador"], icon: icono(<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>) },
  { id: "configuracion", path: "/panel/configuracion", label: "Configuración", group: "administracion", roles: ["rh", "administrador"], icon: icono(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 1-2.8 1.2v.2a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 7.2 20l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.2 14H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.2V3a2 2 0 0 1 4 0v.1A1.7 1.7 0 0 0 16.8 4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.4 1.4z"/></>) },
];

export const menuPorRol = (rol: RolUsuario): NavegacionItem[] => NAVEGACION.filter((item) => item.roles.includes(rol));
export const puedeAcceder = (rol: RolUsuario, ruta: RutaPanel): boolean => NAVEGACION.some((item) => item.id === ruta && item.roles.includes(rol));
export const rutaInicialPara = (rol: RolUsuario): RutaPanel => menuPorRol(rol)[0]?.id ?? "dashboard";
export const navegacionPorId = (ruta: RutaPanel): NavegacionItem | undefined => NAVEGACION.find((item) => item.id === ruta);

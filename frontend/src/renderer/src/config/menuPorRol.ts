import { RolUsuario } from "../api/auth";

// Fuente única de verdad: qué rutas de /panel puede alcanzar cada rol.
// La consumen AdminLayout.tsx (qué se muestra en el sidebar) Y App.tsx (qué
// rutas son navegables) — antes eran dos lugares con lógica independiente
// (booleans sueltos en App.tsx + un filtro deny-list en AdminLayout.tsx) que
// podían desincronizarse, como pasaba con encargado_seccion (veía Dashboard/
// Nómina/Trabajadores en el sidebar sin que ninguna ruta se lo bloqueara).
//
// Cada lista está verificada contra lo que el backend REALMENTE permite para
// ese rol (permitirRoles(...) en cada router), no contra lo que "debería"
// tener sentido — mostrar un ítem que el backend va a rechazar con 403 es el
// mismo bug de raíz sin importar a qué rol le pase. Por eso administrador NO
// incluye "asistencias" (GET /asistencias es rh/recepcion/encargado_seccion,
// ver asistencia.routes.ts), "trabajadores" (GET /trabajadores es rh-only,
// ver trabajador.routes.ts) ni "encargado" (POST /asignaciones y GET
// /asignaciones/sugerencia son rh/encargado_seccion, ver asignacion.routes.ts)
// — administrador podía verlos en el sidebar antes de este cambio, pero
// nunca pudo usarlos de verdad.
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

export const menuPorRol: Record<RolUsuario, RutaPanel[]> = {
  // trabajador nunca entra a /panel (login normal no aplica a ese rol, ver
  // CLAUDE.md) — la lista existe solo para que el Record esté completo.
  trabajador: [],
  recepcion: ["asistencias"],
  // Único ítem: la vista de su(s) sección(es) — sin importar cuántas
  // secciones tenga asignadas, eso es scoping de datos DENTRO de
  // EncargadoPage (verificarAccesoSeccion), no un ítem de sidebar distinto.
  encargado_seccion: ["encargado"],
  rh: ["dashboard", "incidencias", "asistencias", "trabajadores", "encargado", "nomina", "reportes", "configuracion"],
  administrador: ["dashboard", "incidencias", "auditoria", "usuarios", "terminales"],
};

// "Home" del rol = primer ítem que tiene permitido ver. Reemplaza el
// rutaInicialPara(rol) anterior (hardcodeado a "recepcion ? asistencias :
// dashboard"), que producía "/panel/dashboard" para encargado_seccion aunque
// ese rol nunca debiera aterrizar ahí.
export function rutaInicialPara(rol: RolUsuario): RutaPanel {
  return menuPorRol[rol][0] ?? "dashboard";
}

export function puedeAcceder(rol: RolUsuario, ruta: RutaPanel): boolean {
  return menuPorRol[rol].includes(ruta);
}

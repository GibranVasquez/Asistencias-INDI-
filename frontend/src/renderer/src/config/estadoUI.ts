const CLAVE_ESTADO_UI = "indi_ultimo_estado_ui";

// Whitelist explícita — solo {ruta} se lee/escribe aquí, nunca estado de
// formulario (ver TrabajadorFormPage/ConfiguracionPage/UsuariosPage: ninguno
// de sus useState toca esta clave).
interface UltimoEstadoUI {
  ruta: string;
}

function leerEstado(): UltimoEstadoUI | null {
  const crudo = localStorage.getItem(CLAVE_ESTADO_UI);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as UltimoEstadoUI;
  } catch {
    return null;
  }
}

function escribirEstado(estado: UltimoEstadoUI): void {
  localStorage.setItem(CLAVE_ESTADO_UI, JSON.stringify(estado));
}

export function leerRutaPersistida(): string | null {
  return leerEstado()?.ruta ?? null;
}

// Se llama en cada cambio de ruta dentro de /panel (ver AdminLayout.tsx) —
// no depende de "Recordarme": es conveniencia de UI para la ejecución
// actual de la app, no una credencial (ver justificación en la propuesta
// de diseño). Se limpia por completo en cerrarSesion (AuthContext.tsx) para
// que un cambio de usuario en la misma máquina nunca herede la ruta de la
// sesión anterior.
export function guardarRutaPersistida(ruta: string): void {
  escribirEstado({ ruta });
}

export function limpiarEstadoUI(): void {
  localStorage.removeItem(CLAVE_ESTADO_UI);
}

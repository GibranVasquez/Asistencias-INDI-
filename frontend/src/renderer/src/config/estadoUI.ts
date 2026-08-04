const CLAVE_ESTADO_UI = "indi_ultimo_estado_ui";

// Whitelist explícita — solo {ruta, filtros} se lee/escribe aquí, nunca
// estado de formulario (ver TrabajadorFormPage/ConfiguracionPage/UsuariosPage:
// ninguno de sus useState toca esta clave). Cada página solo lee/escribe su
// propia sub-clave dentro de `filtros`, así que en la práctica se comporta
// como estado independiente por página — este objeto es solo el transporte.
export interface FiltrosUI {
  dashboard?: { rango: string };
  nomina?: { inicioSemana: string };
  reportes?: {
    tab: string;
    asistencia?: { desde: string; hasta: string; seccionId?: string };
    nomina?: { desde: string; hasta: string };
  };
  asistencias?: { fechaDesde: string; fechaHasta: string; seccionFiltro?: string };
}

interface UltimoEstadoUI {
  ruta: string;
  filtros: FiltrosUI;
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
// que un cambio de usuario en la misma máquina nunca herede la ruta/filtros
// de la sesión anterior.
export function guardarRutaPersistida(ruta: string): void {
  const actual = leerEstado() ?? { ruta: "", filtros: {} };
  escribirEstado({ ...actual, ruta });
}

export function leerFiltroPersistido<K extends keyof FiltrosUI>(pagina: K): FiltrosUI[K] | undefined {
  return leerEstado()?.filtros[pagina];
}

export function guardarFiltroPersistido<K extends keyof FiltrosUI>(pagina: K, valor: NonNullable<FiltrosUI[K]>): void {
  const actual = leerEstado() ?? { ruta: "", filtros: {} };
  escribirEstado({ ...actual, filtros: { ...actual.filtros, [pagina]: valor } });
}

export function limpiarEstadoUI(): void {
  localStorage.removeItem(CLAVE_ESTADO_UI);
}

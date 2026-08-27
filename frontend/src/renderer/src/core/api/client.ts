// window.indiApp.apiBaseUrl (Electron, resuelta en runtime por el proceso
// principal — ver src/main/apiConfig.ts) manda siempre que exista; el env
// var de Vite solo cubre un preview de navegador puro sin Electron (no pasa
// en la app empaquetada ni en `electron-vite dev`, donde el preload siempre
// corre y la expone).
const API_BASE_URL = window.indiApp?.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "production" ? "https://api.sistemasindi.com" : "http://localhost:4000");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type EscuchaMantenimiento = (activo: boolean) => void;
const escuchasMantenimiento = new Set<EscuchaMantenimiento>();
let estadoMantenimientoNotificado = false;
export function escucharMantenimiento(escucha: EscuchaMantenimiento): () => void {
  escuchasMantenimiento.add(escucha);
  // Conserva el último health observado: los efectos hijos pueden comprobar
  // salud antes de que el provider padre termine de suscribirse.
  escucha(estadoMantenimientoNotificado);
  return () => escuchasMantenimiento.delete(escucha);
}
function notificarMantenimiento(activo: boolean): void {
  estadoMantenimientoNotificado = activo;
  for (const escucha of escuchasMantenimiento) escucha(activo);
}

export async function comprobarSalud(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
    if (!respuesta.ok) return false;
    const datos = await respuesta.json().catch(() => null);
    notificarMantenimiento(datos?.maintenance === true);
    return datos?.status === "ok";
  } catch {
    return false;
  }
}

interface Opciones {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

async function solicitud<T>(ruta: string, opciones: Opciones): Promise<T> {
  const respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
    method: opciones.method,
    headers: {
      "Content-Type": "application/json",
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
    },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 503 && datos?.error === "MAINTENANCE_MODE") {
      notificarMantenimiento(true);
      throw new ApiError(respuesta.status, datos?.message ?? "El sistema se encuentra temporalmente en mantenimiento.", datos.error);
    }
    throw new ApiError(respuesta.status, datos?.error ?? "Error inesperado del servidor.", datos?.error);
  }

  return datos as T;
}

export const apiClient = {
  get: <T>(ruta: string, token?: string | null) => solicitud<T>(ruta, { method: "GET", token }),
  post: <T>(ruta: string, body: unknown, token?: string | null) =>
    solicitud<T>(ruta, { method: "POST", body, token }),
  patch: <T>(ruta: string, body: unknown, token?: string | null) =>
    solicitud<T>(ruta, { method: "PATCH", body, token }),
  del: <T>(ruta: string, token?: string | null) => solicitud<T>(ruta, { method: "DELETE", token }),
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
    throw new ApiError(respuesta.status, datos?.error ?? "Error inesperado del servidor.");
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

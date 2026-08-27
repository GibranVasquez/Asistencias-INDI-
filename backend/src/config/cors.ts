import type { CorsOptions } from "cors";

export const ORIGEN_ELECTRON_DESARROLLO = "http://localhost:5174";

/** Convierte el formato histórico de un único ALLOWED_ORIGIN en una allowlist. */
export function obtenerOrigensPermitidos(valor: string | undefined = process.env.ALLOWED_ORIGIN): string[] {
  const configurados = (valor ?? "")
    .split(",")
    .map((origen) => origen.trim())
    .filter(Boolean);
  return [...new Set([ORIGEN_ELECTRON_DESARROLLO, ...configurados])];
}

export function origenPermitido(origen: string | undefined, permitidos: readonly string[]): boolean {
  // Peticiones server-to-server o health sin Origin no requieren CORS.
  return origen === undefined || permitidos.includes(origen);
}

export function crearOpcionesCors(): CorsOptions {
  const permitidos = obtenerOrigensPermitidos();
  return {
    origin: (origen, callback) => callback(null, origenPermitido(origen, permitidos)),
    credentials: false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

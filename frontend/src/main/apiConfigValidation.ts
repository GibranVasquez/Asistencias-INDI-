const PROTOCOLOS_API_PERMITIDOS = new Set(["http:", "https:"]);
const MENSAJE_URL_INVALIDA = "apiBaseUrl debe ser una URL absoluta HTTP o HTTPS válida.";
export const URL_API_DESARROLLO = "http://localhost:4000";
export const URL_API_PRODUCCION = "https://api.sistemasindi.com";

export function urlApiPorDefecto(empaquetada: boolean): string {
  return empaquetada ? URL_API_PRODUCCION : URL_API_DESARROLLO;
}

export function validarApiBaseUrl(valor: unknown): string {
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new Error(MENSAJE_URL_INVALIDA);
  }

  const normalizada = valor.trim();
  let url: URL;
  try {
    url = new URL(normalizada);
  } catch {
    throw new Error(MENSAJE_URL_INVALIDA);
  }

  if (!PROTOCOLOS_API_PERMITIDOS.has(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(MENSAJE_URL_INVALIDA);
  }

  return normalizada;
}

export function extraerApiBaseUrl(config: unknown): string | undefined {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("config.json debe contener un objeto de configuración válido.");
  }

  if (!("apiBaseUrl" in config)) return undefined;
  return validarApiBaseUrl((config as { apiBaseUrl?: unknown }).apiBaseUrl);
}

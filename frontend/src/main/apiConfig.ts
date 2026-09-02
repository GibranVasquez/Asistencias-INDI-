import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { extraerApiBaseUrl, validarApiBaseUrl, urlApiPorDefecto } from "./apiConfigValidation";
const NOMBRE_ARCHIVO = "config.json";

function rutaConfig(): string {
  return join(app.getPath("userData"), NOMBRE_ARCHIVO);
}

// Si el archivo no existe (primer arranque, o tras una reinstalación que no
// tocó userData), lo crea con el valor por defecto del entorno — así queda un archivo
// real y descubrible para que quien instale la app en su destino final solo
// tenga que editar apiBaseUrl y reiniciar, sin recompilar ni reinstalar.
function leerConfigArchivo(): unknown {
  const ruta = rutaConfig();

  if (!existsSync(ruta)) {
    const contenido = {
      _comentario: "URL base del backend Express. Edita apiBaseUrl y reinicia la app -- no hace falta recompilar ni reinstalar.",
      // Las instalaciones nuevas apuntan al backend local. El usuario puede
      // cambiarlo explícitamente en este archivo o mediante la variable de
      // entorno INDI_API_BASE_URL.
      apiBaseUrl: urlApiPorDefecto(false),
    };
    try {
      mkdirSync(app.getPath("userData"), { recursive: true });
      writeFileSync(ruta, JSON.stringify(contenido, null, 2), "utf-8");
    } catch (err) {
      console.warn("[apiConfig] no se pudo crear config.json:", err);
    }
    return contenido;
  }

  try {
    return JSON.parse(readFileSync(ruta, "utf-8")) as unknown;
  } catch (err) {
    console.warn("[apiConfig] config.json existente no es JSON válido, usando el valor por defecto:", err);
    return {};
  }
}

/**
 * Resuelve la URL base de la API en tiempo de ejecución (nunca horneada en
 * el build): apiBaseUrl en config.json bajo userData (editable sin
 * recompilar) > INDI_API_BASE_URL (override explícito de entorno) > fallback
 * local.
 */
export function resolverApiBaseUrl(): string {
  const config = leerConfigArchivo();
  const configurada = extraerApiBaseUrl(config);
  if (configurada) return configurada;
  if (process.env.INDI_API_BASE_URL) return validarApiBaseUrl(process.env.INDI_API_BASE_URL);
  return urlApiPorDefecto(false);
}

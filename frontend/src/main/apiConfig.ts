import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const URL_POR_DEFECTO = "http://localhost:4000";
const NOMBRE_ARCHIVO = "config.json";

interface ConfigArchivo {
  apiBaseUrl?: string;
}

function rutaConfig(): string {
  return join(app.getPath("userData"), NOMBRE_ARCHIVO);
}

// Si el archivo no existe (primer arranque, o tras una reinstalación que no
// tocó userData), lo crea con el valor de desarrollo — así queda un archivo
// real y descubrible para que quien instale la app en su destino final solo
// tenga que editar apiBaseUrl y reiniciar, sin recompilar ni reinstalar.
function leerConfigArchivo(): ConfigArchivo {
  const ruta = rutaConfig();

  if (!existsSync(ruta)) {
    const contenido = {
      _comentario: "URL base del backend Express. Edita apiBaseUrl y reinicia la app -- no hace falta recompilar ni reinstalar.",
      apiBaseUrl: URL_POR_DEFECTO,
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
    return JSON.parse(readFileSync(ruta, "utf-8")) as ConfigArchivo;
  } catch (err) {
    console.warn("[apiConfig] config.json existente no es JSON válido, usando el valor por defecto:", err);
    return {};
  }
}

/**
 * Resuelve la URL base de la API en tiempo de ejecución (nunca horneada en
 * el build): INDI_API_BASE_URL (variable de entorno, override rápido sin
 * tocar archivos) > apiBaseUrl en config.json bajo userData (editable sin
 * recompilar) > URL de desarrollo por defecto.
 */
export function resolverApiBaseUrl(): string {
  if (process.env.INDI_API_BASE_URL) {
    return process.env.INDI_API_BASE_URL;
  }

  const config = leerConfigArchivo();
  return config.apiBaseUrl || URL_POR_DEFECTO;
}

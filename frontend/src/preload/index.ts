import { contextBridge, ipcRenderer } from "electron";

// main/index.ts pasa la URL ya resuelta (env var o config.json en userData,
// ver apiConfig.ts) como additionalArguments — el preload solo la parsea de
// su propio process.argv, nunca vuelve a resolverla.
const PREFIJO_API_BASE_URL = "--indi-api-base-url=";
function leerApiBaseUrl(): string {
  const arg = process.argv.find((a) => a.startsWith(PREFIJO_API_BASE_URL));
  return arg ? arg.slice(PREFIJO_API_BASE_URL.length) : (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "https://api.sistemasindi.com");
}

// Bandera minima expuesta al renderer: si arrancamos en modo kiosco fisico
// (pantalla completa bloqueada) para que la UI se comporte distinto (ej. sin
// forma facil de volver a /login) — sin exponer el resto de la API de Electron.
//
// sesionSegura: unica via para persistir la sesion del panel admin. El
// cifrado real (safeStorage) vive en el proceso principal (secureStore.ts);
// el renderer solo ve estos tres metodos, nunca el archivo ni la clave.
contextBridge.exposeInMainWorld("indiApp", {
  esKiosco: process.argv.includes("--kiosk") || process.env.INDI_KIOSK === "1",
  apiBaseUrl: leerApiBaseUrl(),
  guardarExportacion: (solicitud: { nombreSugerido: string; formato: "pdf" | "xlsx"; bytes: Uint8Array }): Promise<{ cancelado: boolean; guardado?: boolean }> =>
    ipcRenderer.invoke("archivo:guardar-exportacion", solicitud),
  sesionSegura: {
    guardar: (valor: string, persistir: boolean): Promise<void> =>
      ipcRenderer.invoke("secure-store:guardar", valor, persistir),
    leer: (): Promise<{ valor: string; persistida: boolean } | null> => ipcRenderer.invoke("secure-store:leer"),
    borrar: (): Promise<void> => ipcRenderer.invoke("secure-store:borrar"),
  },
  sesionTerminalSegura: {
    guardar: (valor: string): Promise<void> => ipcRenderer.invoke("terminal-secure-store:guardar", valor),
    leer: (): Promise<string | null> => ipcRenderer.invoke("terminal-secure-store:leer"),
    borrar: (): Promise<void> => ipcRenderer.invoke("terminal-secure-store:borrar"),
  },
  terminales: {
    leerConfig: (terminalId: string): Promise<unknown> => ipcRenderer.invoke("terminal-local:leer-config", terminalId),
    guardarConfig: (config: unknown): Promise<unknown> => ipcRenderer.invoke("terminal-local:guardar-config", config),
    probarConexion: (config: unknown): Promise<unknown> => ipcRenderer.invoke("terminal-local:probar", config),
    descargarMarcaciones: (config: unknown): Promise<unknown> => ipcRenderer.invoke("terminal-local:descargar", config),
  },
});

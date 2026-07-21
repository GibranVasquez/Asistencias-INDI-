import { contextBridge, ipcRenderer } from "electron";

// Bandera minima expuesta al renderer: si arrancamos en modo kiosco fisico
// (pantalla completa bloqueada) para que la UI se comporte distinto (ej. sin
// forma facil de volver a /login) — sin exponer el resto de la API de Electron.
//
// sesionSegura: unica via para persistir la sesion del panel admin. El
// cifrado real (safeStorage) vive en el proceso principal (secureStore.ts);
// el renderer solo ve estos tres metodos, nunca el archivo ni la clave.
contextBridge.exposeInMainWorld("indiApp", {
  esKiosco: process.argv.includes("--kiosk") || process.env.INDI_KIOSK === "1",
  sesionSegura: {
    guardar: (valor: string, persistir: boolean): Promise<void> =>
      ipcRenderer.invoke("secure-store:guardar", valor, persistir),
    leer: (): Promise<{ valor: string; persistida: boolean } | null> => ipcRenderer.invoke("secure-store:leer"),
    borrar: (): Promise<void> => ipcRenderer.invoke("secure-store:borrar"),
  },
});

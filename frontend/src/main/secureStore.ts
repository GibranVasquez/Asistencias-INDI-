import { app, ipcMain, safeStorage } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

// Reemplaza localStorage plano para la sesion del panel admin: esta misma
// app eventualmente corre el panel de RH con acceso a sueldos/CLABE en la
// misma maquina, asi que "recordarme" no puede quedar como texto plano en
// el perfil de Chromium. safeStorage cifra con las credenciales del SO
// (Keychain/DPAPI/libsecret); el archivo cifrado se guarda en userData.
//
// recordar=false (sesion "solo esta ventana") NUNCA toca disco: vive
// unicamente en esta variable de memoria del proceso principal, y se pierde
// al cerrar la app — equivalente a lo que sessionStorage pretendia lograr,
// pero sin que Chromium lo persista en su propio LevelDB interno.
let sesionEnMemoria: string | null = null;

function archivoSesion(): string {
  return join(app.getPath("userData"), "sesion.enc");
}

function archivoSesionTerminal(): string {
  return join(app.getPath("userData"), "terminal-sesion.enc");
}

function terminalPuedePersistirseConCifradoReal(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  // En Linux Electron puede reportar safeStorage disponible usando
  // `basic_text`, que solo ofusca. Para un JWT persistente eso no cuenta
  // como almacenamiento seguro y debe fallar cerrado.
  return process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text";
}

export function registrarHandlersSecureStore(): void {
  ipcMain.handle("secure-store:guardar", (_evento, valor: string, persistir: boolean) => {
    const ruta = archivoSesion();

    if (!persistir) {
      sesionEnMemoria = valor;
      if (existsSync(ruta)) unlinkSync(ruta);
      return;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("El almacenamiento seguro del sistema operativo no está disponible en este equipo.");
    }
    writeFileSync(ruta, safeStorage.encryptString(valor));
    sesionEnMemoria = null;
  });

  // Devuelve tambien `persistida`: el renderer necesita saberlo para
  // mostrar (de forma persistente, no un toast que desaparece) que esta
  // sesion NO sobrevivira si se cierra la app — nunca debe verse igual que
  // una sesion realmente recordada.
  ipcMain.handle("secure-store:leer", (): { valor: string; persistida: boolean } | null => {
    if (sesionEnMemoria !== null) return { valor: sesionEnMemoria, persistida: false };

    const ruta = archivoSesion();
    if (!existsSync(ruta)) return null;

    try {
      return { valor: safeStorage.decryptString(readFileSync(ruta)), persistida: true };
    } catch {
      return null;
    }
  });

  ipcMain.handle("secure-store:borrar", () => {
    sesionEnMemoria = null;
    const ruta = archivoSesion();
    if (existsSync(ruta)) unlinkSync(ruta);
  });

  // La sesion del Terminal siempre debe sobrevivir reinicios, por lo que no
  // tiene fallback en memoria ni en texto plano. Usa un archivo distinto al
  // de la sesion humana para que cerrar una no afecte a la otra.
  ipcMain.handle("terminal-secure-store:guardar", (_evento, valor: string) => {
    if (!terminalPuedePersistirseConCifradoReal()) {
      throw new Error("El almacenamiento seguro del sistema operativo no está disponible en este equipo.");
    }
    writeFileSync(archivoSesionTerminal(), safeStorage.encryptString(valor));
  });

  ipcMain.handle("terminal-secure-store:leer", (): string | null => {
    const ruta = archivoSesionTerminal();
    if (!existsSync(ruta)) return null;
    if (!terminalPuedePersistirseConCifradoReal()) {
      throw new Error("El almacenamiento seguro del sistema operativo no está disponible en este equipo.");
    }
    try {
      return safeStorage.decryptString(readFileSync(ruta));
    } catch {
      throw new Error("No se pudo descifrar la sesión segura del Terminal.");
    }
  });

  ipcMain.handle("terminal-secure-store:borrar", () => {
    const ruta = archivoSesionTerminal();
    if (existsSync(ruta)) unlinkSync(ruta);
  });
}

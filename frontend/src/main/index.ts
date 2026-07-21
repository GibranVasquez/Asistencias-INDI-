import { app, BrowserWindow } from "electron";
import { join } from "path";
import { registrarHandlersSecureStore } from "./secureStore";

// El kiosco fisico se lanza con --kiosk (o INDI_KIOSK=1): pantalla completa,
// bloqueado, y entra directo a /kiosco. Sin esa bandera es el panel
// administrativo normal (login, ventana con marco, redimensionable) — asi
// se puede seguir desarrollando/probando sin quedar atrapado en fullscreen.
const esLanzamientoKiosco = process.argv.includes("--kiosk") || process.env.INDI_KIOSK === "1";

// Chromium/Electron solo autodetecta el backend de safeStorage mirando
// XDG_CURRENT_DESKTOP (gnome/kde/unity/xfce) — en escritorios wlroots no
// reconocidos (Hyprland, Sway, i3, etc.) cae al backend "basic_text" aunque
// haya un daemon de secretos real corriendo (gnome-keyring vía dbus, que es
// el proveedor de facto en la mayoría de esos WMs). Forzamos gnome-libsecret
// en ese caso; si de verdad no hay ningún daemon de secretos disponible,
// safeStorage.encryptString sigue fallando, pero AuthContext ya degrada esa
// falla a una sesión solo-en-memoria en vez de romper el login.
if (process.platform === "linux") {
  const escritorioReconocido = /gnome|kde|unity|xfce/i.test(process.env.XDG_CURRENT_DESKTOP ?? "");
  if (!escritorioReconocido) {
    app.commandLine.appendSwitch("password-store", "gnome-libsecret");
  }
}

function crearVentanaPrincipal(): void {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "INDI · Registro de Asistencia",
    backgroundColor: "#0B1E3D",
    autoHideMenuBar: true,
    fullscreen: esLanzamientoKiosco,
    kiosk: esLanzamientoKiosco,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const rutaInicial = esLanzamientoKiosco ? "/kiosco" : "/";

  if (process.env["ELECTRON_RENDERER_URL"]) {
    ventana.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#${rutaInicial}`);
  } else {
    ventana.loadFile(join(__dirname, "../renderer/index.html"), { hash: rutaInicial });
  }
}

app.whenReady().then(() => {
  registrarHandlersSecureStore();
  crearVentanaPrincipal();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentanaPrincipal();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

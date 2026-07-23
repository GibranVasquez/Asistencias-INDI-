import { app, BrowserWindow, session } from "electron";
import { join } from "path";
import { resolverApiBaseUrl } from "./apiConfig";
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
  // Resuelta en tiempo de ejecución (env var o config.json en userData, ver
  // apiConfig.ts) — nunca horneada en el build, para que el paquete final
  // pueda apuntar a donde termine viviendo el backend sin recompilar.
  const apiBaseUrl = resolverApiBaseUrl();

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
      additionalArguments: [`--indi-api-base-url=${apiBaseUrl}`],
    },
  });

  const rutaInicial = esLanzamientoKiosco ? "/kiosco" : "/";

  if (process.env["ELECTRON_RENDERER_URL"]) {
    ventana.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#${rutaInicial}`);
  } else {
    ventana.loadFile(join(__dirname, "../renderer/index.html"), { hash: rutaInicial });
  }
}

// Sin este handler, guardar un blob (reportes en PDF/Excel, ver
// api/reportes.ts) vía <a download> depende del comportamiento por-defecto
// de Chromium ante una descarga — que en pruebas resultó intermitente bajo
// Electron. Fijar explícitamente la carpeta de Descargas del sistema (sin
// diálogo "Guardar como") lo vuelve determinista.
function registrarDescargas(): void {
  session.defaultSession.on("will-download", (_evento, item) => {
    item.setSavePath(join(app.getPath("downloads"), item.getFilename()));
  });
}

app.whenReady().then(() => {
  registrarHandlersSecureStore();
  registrarDescargas();
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

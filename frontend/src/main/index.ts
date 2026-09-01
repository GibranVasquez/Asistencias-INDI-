import { app, BrowserWindow, session } from "electron";
import { isAbsolute, join, resolve } from "path";
import { resolverApiBaseUrl } from "./apiConfig";
import { construirContentSecurityPolicy, esNavegacionAlMismoDocumento } from "./contentSecurityPolicy";
import { registrarHandlersSecureStore } from "./secureStore";
import { registrarHandlerGuardarExportacion } from "./exportaciones";
import { registrarHandlersTerminalLocal } from "./terminalLocal";

// Electron 43 + NVIDIA bajo Wayland pierde el contexto EGL de forma repetida
// (eglCreateImage 0x3009) hasta terminar el proceso GPU. En esa combinación
// concreta se usa composición por software; Windows, X11 y otros entornos
// conservan aceleración de hardware.
if (process.platform === "linux" && Boolean(process.env.WAYLAND_DISPLAY)) {
  app.disableHardwareAcceleration();
}

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
// safeStorage.encryptString sigue fallando, pero ContextoAutenticacion ya degrada esa
// falla a una sesión solo-en-memoria en vez de romper el login.
if (process.platform === "linux") {
  const escritorioReconocido = /gnome|kde|unity|xfce/i.test(process.env.XDG_CURRENT_DESKTOP ?? "");
  if (!escritorioReconocido) {
    app.commandLine.appendSwitch("password-store", "gnome-libsecret");
  }
}

// Los E2E deben arrancar con un perfil desechable y nunca leer la sesión real
// del desarrollador. La variable solo se acepta en NODE_ENV=test y dentro del
// directorio temporal del sistema; cualquier otra combinación aborta.
const directorioUsuarioE2E = process.env.INDI_E2E_USER_DATA_DIR;
if (directorioUsuarioE2E) {
  const temporal = resolve(app.getPath("temp"));
  const destino = resolve(directorioUsuarioE2E);
  const dentroDeTemporal = destino.startsWith(`${temporal}/`) && isAbsolute(directorioUsuarioE2E);
  if (process.env.NODE_ENV !== "test" || !dentroDeTemporal || !destino.split("/").at(-1)?.startsWith("indi-e2e-")) {
    throw new Error("INDI_E2E_USER_DATA_DIR solo admite un perfil indi-e2e-* dentro del directorio temporal.");
  }
  app.setPath("userData", destino);
}

function crearVentanaPrincipal(apiBaseUrl: string): void {
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
      sandbox: true,
      additionalArguments: [`--indi-api-base-url=${apiBaseUrl}`],
    },
  });

  ventana.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  ventana.webContents.on("will-navigate", (evento, destino) => {
    if (!esNavegacionAlMismoDocumento(ventana.webContents.getURL(), destino)) {
      evento.preventDefault();
    }
  });

  const rutaInicial = esLanzamientoKiosco ? "/kiosco" : "/";

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void ventana.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}#${rutaInicial}`);
  } else {
    void ventana.loadFile(join(__dirname, "../renderer/index.html"), { hash: rutaInicial });
  }
}

function registrarPoliticaDeContenido(apiBaseUrl: string): void {
  const politica = construirContentSecurityPolicy({
    apiBaseUrl,
    desarrollo: Boolean(process.env["ELECTRON_RENDERER_URL"]),
  });
  session.defaultSession.webRequest.onHeadersReceived((detalles, responder) => {
    if (detalles.resourceType !== "mainFrame") {
      responder({ responseHeaders: detalles.responseHeaders });
      return;
    }
    responder({
      responseHeaders: {
        ...detalles.responseHeaders,
        "Content-Security-Policy": [politica],
      },
    });
  });
}

function restringirPermisos(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permiso, responder) => responder(false));
}

// Las exportaciones que pasan por el bridge `archivo:guardar-exportacion`
// muestran su propio diálogo nativo. Este handler se conserva para descargas
// web/fallback que todavía utilicen `<a download>` en otras áreas.
function registrarDescargas(): void {
  session.defaultSession.on("will-download", (_evento, item) => {
    item.setSavePath(join(app.getPath("downloads"), item.getFilename()));
  });
}

void app.whenReady().then(() => {
  // La URL se resuelve una sola vez y alimenta tanto al preload como a CSP.
  let apiBaseUrl: string;
  try {
    apiBaseUrl = resolverApiBaseUrl();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "La configuración de la API no es válida.";
    console.error(`[apiConfig] ${mensaje}`);
    app.quit();
    return;
  }
  registrarHandlersSecureStore();
  registrarHandlersTerminalLocal();
  registrarHandlerGuardarExportacion();
  registrarDescargas();
  registrarPoliticaDeContenido(apiBaseUrl);
  restringirPermisos();
  crearVentanaPrincipal(apiBaseUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentanaPrincipal(apiBaseUrl);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

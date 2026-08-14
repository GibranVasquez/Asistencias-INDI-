import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { _electron as electron, ElectronApplication, Page } from "playwright";

const frontend = resolve(process.cwd());
const raizPerfilesConfigurada = process.env.INDI_E2E_USER_DATA_ROOT;
const apiUrlConfigurada = process.env.INDI_E2E_API_URL;

if (!raizPerfilesConfigurada || !apiUrlConfigurada || new URL(apiUrlConfigurada).hostname !== "127.0.0.1") {
  throw new Error("E2E abortado: faltan el perfil temporal o la API local 127.0.0.1.");
}
const raizPerfiles: string = raizPerfilesConfigurada;
const apiUrl: string = apiUrlConfigurada;

export const PASSWORD_E2E = "E2E-only-Password!42";

export interface AppE2E {
  electronApp: ElectronApplication;
  page: Page;
  erroresRuntime: string[];
  csp: string;
}

export async function lanzarElectron(nombrePerfil: string, kiosco = false): Promise<AppE2E> {
  const userData = join(raizPerfiles, `indi-e2e-${nombrePerfil}`);
  await mkdir(userData, { recursive: true });
  const electronApp = await electron.launch({
    executablePath: join(frontend, "node_modules/electron/dist/electron"),
    args: [frontend, ...(kiosco ? ["--kiosk"] : [])],
    cwd: frontend,
    env: {
      ...process.env,
      NODE_ENV: "test",
      INDI_API_BASE_URL: apiUrl,
      INDI_E2E_USER_DATA_DIR: userData,
      ...(kiosco ? { INDI_KIOSK: "1" } : {}),
    },
  });
  const erroresRuntime: string[] = [];
  const page = await electronApp.firstWindow();
  page.on("pageerror", (error) => erroresRuntime.push(`pageerror: ${error.message}`));
  page.on("console", (mensaje) => {
    const texto = mensaje.text();
    if (/content security policy|refused to (execute|load)|preload.*error|unhandled rejection/i.test(texto)) {
      erroresRuntime.push(`console: ${texto}`);
    }
  });
  const respuestaPrincipal = await Promise.all([
    page.waitForResponse((respuesta) => respuesta.request().resourceType() === "document"),
    page.reload(),
  ]).then(([respuesta]) => respuesta).catch(() => null);
  const csp = respuestaPrincipal ? (await respuestaPrincipal.allHeaders())["content-security-policy"] ?? "" : "";
  await page.locator("body").waitFor();
  return { electronApp, page, erroresRuntime, csp };
}

export async function login(page: Page, rol: "rh" | "administrador" | "recepcion" | "encargado_seccion", recordar = true): Promise<void> {
  await page.getByLabel("Usuario").fill(`e2e-${rol}`);
  await page.locator('input[type="password"]').fill(PASSWORD_E2E);
  const checkboxRecordar = page.getByRole("checkbox", { name: "Recordarme" });
  if ((await checkboxRecordar.isChecked()) !== recordar) await checkboxRecordar.click();
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
}

export async function cerrar(app: AppE2E): Promise<void> {
  await app.electronApp.close();
  if (app.erroresRuntime.length > 0) {
    throw new Error(`Errores críticos de runtime:\n${app.erroresRuntime.join("\n")}`);
  }
}

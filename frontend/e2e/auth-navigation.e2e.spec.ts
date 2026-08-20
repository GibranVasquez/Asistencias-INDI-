import { expect, test } from "@playwright/test";
import { cerrar, lanzarElectron, login, PASSWORD_E2E } from "./electron.fixture";

test("Electron conserva sandbox, aislamiento, preload, CSP y navegación hash", async () => {
  const app = await lanzarElectron("seguridad");
  try {
    const preferencias = await app.electronApp.evaluate(({ BrowserWindow }) => {
      const ventana = BrowserWindow.getAllWindows()[0];
      return (ventana.webContents as unknown as { getLastWebPreferences: () => Record<string, unknown> }).getLastWebPreferences();
    });
    expect(preferencias.contextIsolation).toBe(true);
    expect(preferencias.nodeIntegration).toBe(false);
    expect(preferencias.sandbox).toBe(true);
    expect(await app.page.evaluate(() => typeof (window as Window & { indiApp?: { sesionSegura: { leer: unknown } } }).indiApp?.sesionSegura.leer)).toBe("function");
    expect(await app.page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe("undefined");
    expect(app.csp).toContain("default-src 'none'");
    expect(app.csp).toContain(`connect-src 'self' ${process.env.INDI_E2E_API_URL}`);
    expect(app.csp).not.toContain("'unsafe-eval'");
    await app.page.evaluate(() => { window.location.hash = "#/login"; });
    await expect(app.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    expect(await app.page.locator(".login-panel").evaluate((elemento) => getComputedStyle(elemento).animationName)).toBe("surfaceEnter");
    await app.page.emulateMedia({ reducedMotion: "reduce" });
    const duracionReducida = await app.page.locator(".login-panel").evaluate((elemento) =>
      Number.parseFloat(getComputedStyle(elemento).animationDuration)
    );
    expect(duracionReducida).toBeLessThanOrEqual(0.001);
    await app.page.emulateMedia({ reducedMotion: "no-preference" });
  } finally {
    await cerrar(app);
  }
});

test("login incorrecto e inexistente entregan el mismo error genérico", async () => {
  const app = await lanzarElectron("credenciales");
  try {
    for (const username of ["e2e-rh", "e2e-usuario-inexistente"]) {
      await app.page.getByLabel("Usuario").fill(username);
      await app.page.locator('input[type="password"]').fill("Password-incorrecto-E2E");
      await app.page.getByRole("button", { name: "Ingresar al panel" }).click();
      await expect(app.page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
      await expect(app.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
      await expect(app.page.getByRole("navigation")).toHaveCount(0);
    }
  } finally {
    await cerrar(app);
  }
});

test("RH navega por menú, bloquea una ruta ajena y logout protege la ruta privada", async () => {
  const app = await lanzarElectron("rh-navegacion");
  try {
    await login(app.page, "rh");
    await expect(app.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
    expect(await app.page.locator(".page-transition").evaluate((elemento) => getComputedStyle(elemento).animationName)).toBe("pageEnter");
    const dona = app.page.locator(".dona-puntualidad");
    await expect(dona).toBeVisible();
    expect(await dona.evaluate((elemento) => getComputedStyle(elemento).animationName)).toBe("donaDraw");
    expect(await dona.getAttribute("aria-label")).toMatch(/% a tiempo:/);
    await dona.evaluate(async (elemento) => {
      await Promise.all(elemento.getAnimations({ subtree: true }).map((animacion) => animacion.finished));
    });
    expect(await dona.evaluate((elemento) => getComputedStyle(elemento).getPropertyValue("--dona-revelado").trim())).toBe("100%");
    await expect(app.page.getByRole("link", { name: "Trabajadores" })).toBeVisible();
    await expect(app.page.getByRole("link", { name: "Nómina RH" })).toBeVisible();
    await app.page.getByRole("link", { name: "Responsables por frente" }).click();
    await expect(app.page.getByRole("heading", { name: "Responsables por frente" })).toBeVisible();
    await expect(app.page.getByRole("combobox", { name: /^Frente/ })).toBeVisible();
    await expect(app.page.getByText("Contacta a RH", { exact: false })).toHaveCount(0);
    await app.page.getByRole("link", { name: "Panel principal" }).click();
    await expect(app.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
    const sidebar = app.page.getByRole("navigation", { name: "Navegación principal" });
    const anchoPrincipalExpandido = (await app.page.locator("main").boundingBox())!.width;
    await app.page.getByRole("button", { name: "Contraer menú" }).click();
    await expect(sidebar).toHaveClass(/contraido/);
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(80);
    await expect(app.page.getByRole("link", { name: "Panel principal" })).toHaveAttribute("aria-current", "page");
    await expect(app.page.getByRole("link", { name: "Trabajadores" })).toHaveAttribute("data-tooltip", "Trabajadores");
    await expect(app.page.locator(".sidebar-label").first()).toBeHidden();
    expect((await app.page.locator("main").boundingBox())!.width).toBeGreaterThan(anchoPrincipalExpandido);
    await app.page.getByRole("link", { name: "Trabajadores" }).hover();
    await app.page.getByRole("link", { name: "Trabajadores" }).click();
    await expect(app.page.getByRole("heading", { name: "Trabajadores" })).toBeVisible();
    await expect(app.page.getByRole("region", { name: "Personal registrado" })).toBeVisible();
    await app.page.getByRole("button", { name: "Expandir menú" }).click();
    await expect(sidebar).not.toHaveClass(/contraido/);
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(230);
    await app.page.evaluate(() => { window.location.hash = "#/panel/usuarios"; });
    await expect(app.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
    await app.page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(app.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await app.page.evaluate(() => { window.location.hash = "#/panel/trabajadores"; });
    await expect(app.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  } finally {
    await cerrar(app);
  }
});

for (const caso of [
  { rol: "administrador" as const, destino: "Panel principal", permitido: "Usuarios", prohibido: "Nómina RH" },
  { rol: "recepcion" as const, destino: "Asistencia", permitido: "Asistencias", prohibido: "Nómina RH" },
  { rol: "encargado_seccion" as const, destino: "Mi frente · hoy", permitido: "Mi frente", prohibido: "Nómina RH" },
]) {
  test(`${caso.rol} solo recibe su navegación permitida`, async () => {
    const app = await lanzarElectron(`rol-${caso.rol}`);
    try {
      await login(app.page, caso.rol);
      await expect(app.page.getByRole("heading", { name: caso.destino, exact: true })).toBeVisible();
      await expect(app.page.getByRole("link", { name: caso.permitido })).toBeVisible();
      await expect(app.page.getByRole("link", { name: caso.prohibido })).toHaveCount(0);
      await app.page.evaluate(() => { window.location.hash = "#/panel/nomina"; });
      await expect(app.page.getByRole("heading", { name: caso.destino, exact: true })).toBeVisible();
      if (caso.rol === "administrador") {
        await expect(app.page.getByRole("button", { name: /Sistema conectado/ })).toBeVisible();
        await app.page.getByRole("link", { name: "Incidencias" }).click();
        await expect(app.page.getByRole("heading", { name: "Centro de incidencias" })).toBeVisible();
        await app.page.getByRole("link", { name: "Auditoría" }).click();
        await expect(app.page.getByRole("heading", { name: "Auditoría", exact: true })).toBeVisible();
        await app.page.getByRole("button", { name: "Cerrar sesión" }).click();
        await expect(app.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
      }
    } finally {
      await cerrar(app);
    }
  });
}

test("Recordarme restaura la sesión humana y logout elimina la persistencia", async () => {
  const primerArranque = await lanzarElectron("persistencia-humana");
  const almacenamiento = await primerArranque.electronApp.evaluate(({ safeStorage }) => ({
    disponible: safeStorage.isEncryptionAvailable(),
    backend: process.platform === "linux" ? safeStorage.getSelectedStorageBackend() : "nativo",
  }));
  if (!almacenamiento.disponible || almacenamiento.backend === "basic_text") {
    await cerrar(primerArranque);
    test.skip(true, `safeStorage seguro no disponible: ${almacenamiento.backend}`);
  }
  await login(primerArranque.page, "rh");
  await expect(primerArranque.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
  await primerArranque.page.getByRole("button", { name: "Contraer menú" }).click();
  await expect(primerArranque.page.getByRole("navigation", { name: "Navegación principal" })).toHaveClass(/contraido/);
  await cerrar(primerArranque);

  const segundoArranque = await lanzarElectron("persistencia-humana");
  await expect(segundoArranque.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
  await expect(segundoArranque.page.getByRole("navigation", { name: "Navegación principal" })).toHaveClass(/contraido/);
  await segundoArranque.page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(segundoArranque.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await cerrar(segundoArranque);

  const tercerArranque = await lanzarElectron("persistencia-humana");
  try {
    await expect(tercerArranque.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await tercerArranque.page.getByLabel("Usuario").fill("e2e-rh");
    await tercerArranque.page.locator('input[type="password"]').fill(PASSWORD_E2E);
    await tercerArranque.page.getByRole("button", { name: "Ingresar al panel" }).click();
    await expect(tercerArranque.page.getByRole("navigation", { name: "Navegación principal" })).toHaveClass(/contraido/);
  } finally {
    await cerrar(tercerArranque);
  }
});

test("sesión humana sin Recordarme vuelve a Login tras reiniciar Electron", async () => {
  const primerArranque = await lanzarElectron("sesion-efimera");
  await login(primerArranque.page, "rh", false);
  await expect(primerArranque.page.getByRole("heading", { name: "Panel principal" })).toBeVisible();
  await primerArranque.page.getByRole("link", { name: "Trabajadores" }).click();
  await expect(primerArranque.page.getByRole("heading", { name: "Trabajadores" })).toBeVisible();
  await cerrar(primerArranque);

  const segundoArranque = await lanzarElectron("sesion-efimera");
  try {
    await expect(segundoArranque.page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(segundoArranque.page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await expect(segundoArranque.page.getByRole("heading", { name: "Trabajadores" })).toHaveCount(0);
    expect(await segundoArranque.page.evaluate(() => window.location.hash)).toBe("#/");
  } finally {
    await cerrar(segundoArranque);
  }
});

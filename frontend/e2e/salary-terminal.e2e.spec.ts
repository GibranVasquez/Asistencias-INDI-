import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { cerrar, lanzarElectron, login, PASSWORD_E2E } from "./electron.fixture";

test("RH aplica sueldo a dos seleccionados sin alterar control ni nómina histórica", async () => {
  const app = await lanzarElectron("sueldo-masivo");
  try {
    await login(app.page, "rh");
    await app.page.getByRole("link", { name: "Trabajadores" }).click();
    await expect(app.page.getByRole("heading", { name: "Trabajadores" })).toBeVisible();
    await app.page.getByRole("checkbox", { name: "Seleccionar a Ana Prueba E2E" }).check();
    await app.page.getByRole("checkbox", { name: "Seleccionar a Bruno Prueba E2E" }).check();
    await expect(app.page.getByText("2 trabajadores seleccionados")).toBeVisible();
    await app.page.getByLabel("Nuevo sueldo base").fill("915.50");
    await app.page.getByRole("button", { name: "Aplicar sueldo" }).click();
    await expect(app.page.getByRole("heading", { name: "Aplicar sueldo a trabajadores seleccionados" })).toBeVisible();
    await expect(app.page.getByText("$915.50")).toBeVisible();
    await app.page.getByRole("button", { name: "Aplicar a 2" }).click();
    await expect(app.page.getByText("Sueldo aplicado correctamente a 2 trabajadores.")).toBeVisible();
    await expect(app.page.getByText("0 trabajadores seleccionados")).toBeVisible();

    const backend = resolve(process.cwd(), "../backend");
    const salida = execFileSync(resolve(backend, "node_modules/.bin/ts-node"), ["scripts/inspect-e2e.ts"], {
      cwd: backend,
      env: process.env,
      encoding: "utf8",
    });
    const estado = JSON.parse(salida) as {
      trabajadores: Array<{ nombre: string; sueldo: number }>;
      nominas: Array<{ trabajador: string; montoSueldo: number; total: number }>;
      auditorias: number;
    };
    expect(estado.trabajadores).toEqual([
      { nombre: "Ana Prueba E2E", sueldo: 915.5 },
      { nombre: "Bruno Prueba E2E", sueldo: 915.5 },
      { nombre: "Control Prueba E2E", sueldo: 800 },
    ]);
    expect(estado.nominas).toEqual([{ trabajador: "Control Prueba E2E", montoSueldo: 500, total: 500 }]);
    expect(estado.auditorias).toBe(2);
  } finally {
    await cerrar(app);
  }
});

test("Terminal usa sesión cifrada, restaura, desvincula y no deja JWT en Web Storage", async () => {
  const primerArranque = await lanzarElectron("terminal", true);
  const almacenamiento = await primerArranque.electronApp.evaluate(({ safeStorage }) => ({
    disponible: safeStorage.isEncryptionAvailable(),
    backend: process.platform === "linux" ? safeStorage.getSelectedStorageBackend() : "nativo",
  }));
  if (!almacenamiento.disponible || almacenamiento.backend === "basic_text") {
    await cerrar(primerArranque);
    test.skip(true, `safeStorage seguro no disponible: ${almacenamiento.backend}`);
  }
  await primerArranque.page.getByPlaceholder("Usuario del terminal").fill("e2e-terminal");
  await primerArranque.page.getByPlaceholder("Contraseña").fill(PASSWORD_E2E);
  await primerArranque.page.getByRole("button", { name: "Activar" }).click();
  await expect(primerArranque.page.getByRole("heading", { name: "Configurar este kiosco" })).toBeVisible();
  expect(await primerArranque.page.evaluate(() => ({
    local: Object.entries(localStorage).filter(([, valor]) => valor.includes("eyJ")),
    session: Object.entries(sessionStorage).filter(([, valor]) => valor.includes("eyJ")),
    heredada: localStorage.getItem("indi_terminal_sesion"),
  }))).toEqual({ local: [], session: [], heredada: null });
  await cerrar(primerArranque);

  const segundoArranque = await lanzarElectron("terminal", true);
  await expect(segundoArranque.page.getByRole("heading", { name: "Configurar este kiosco" })).toBeVisible();
  await segundoArranque.page.getByRole("button", { name: "Confirmación (lector ADMS)" }).click();
  await segundoArranque.page.getByRole("button", { name: /Guardar configuración/ }).click();
  await expect(segundoArranque.page.getByRole("heading", { name: "Esperando marcación…" })).toBeVisible();
  await segundoArranque.page.getByRole("button", { name: "Cerrar sesión del terminal" }).click();
  await cerrar(segundoArranque);

  const tercerArranque = await lanzarElectron("terminal", true);
  try {
    await expect(tercerArranque.page.getByRole("heading", { name: "Activar terminal" })).toBeVisible();
  } finally {
    await cerrar(tercerArranque);
  }
});

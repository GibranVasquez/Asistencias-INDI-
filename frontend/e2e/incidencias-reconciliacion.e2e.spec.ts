import { expect, test } from "@playwright/test";
import { cerrar, lanzarElectron, login } from "./electron.fixture";

test("Administrador reconcilia incidencia con candidato y Frente de la misma Obra", async () => {
  const app = await lanzarElectron("incidencia-reconciliacion");
  try {
    await login(app.page, "administrador");
    await app.page.getByRole("link", { name: "Incidencias" }).click();
    const fila = app.page.getByRole("row").filter({ hasText: "1001" });
    await expect(fila).toContainText("Pendiente");
    await fila.getByRole("button", { name: "Reconciliar" }).click();
    const dialogo = app.page.getByRole("dialog");
    await expect(dialogo).toContainText("Obra ficticia E2E");
    await expect(dialogo).toContainText("Ana Prueba E2E");
    await dialogo.getByRole("checkbox").check();
    const frente = dialogo.getByRole("combobox", { name: "Selecciona el Frente" });
    await frente.selectOption({ label: "Frente ficticio E2E" });
    await dialogo.getByRole("button", { name: "Reconciliar" }).click();
    await expect(dialogo).toContainText("Asistencia registrada correctamente.");
    await expect(fila).toContainText("Reconciliada");
    await expect(fila.getByRole("button", { name: "Revisar" })).toBeVisible();
  } finally {
    await cerrar(app);
  }
});

test("incidencia histórica permanece visible pero bloqueada", async () => {
  const app = await lanzarElectron("incidencia-historica");
  try {
    await login(app.page, "rh");
    await app.page.getByRole("link", { name: "Incidencias" }).click();
    const fila = app.page.getByRole("row").filter({ hasText: "LEGACY-HISTORICO" });
    await fila.getByRole("button", { name: "Revisar" }).click();
    const dialogo = app.page.getByRole("dialog");
    await expect(dialogo).toContainText("requiere revisión especial");
    await expect(dialogo.getByRole("button", { name: "Reconciliar" })).toBeDisabled();
  } finally {
    await cerrar(app);
  }
});

test("incidencia sin Obra permanece visible pero bloqueada", async () => {
  const app = await lanzarElectron("incidencia-sin-obra");
  try {
    await login(app.page, "administrador");
    await app.page.getByRole("link", { name: "Incidencias" }).click();
    const fila = app.page.getByRole("row").filter({ hasText: "SIN-OBRA" });
    await fila.getByRole("button", { name: "Revisar" }).click();
    const dialogo = app.page.getByRole("dialog");
    await expect(dialogo).toContainText("no tiene una Obra de origen");
    await expect(dialogo.getByRole("button", { name: "Reconciliar" })).toBeDisabled();
  } finally {
    await cerrar(app);
  }
});

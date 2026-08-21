import { expect, Page, test } from "@playwright/test";
import { cerrar, lanzarElectron, login } from "./electron.fixture";

async function validarModalGlobal(page: Page, titulo: string): Promise<void> {
  const dialogo = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: titulo }) });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator(".configuracion-modal-acciones")).toBeVisible();
  expect(await dialogo.evaluate((elemento) => elemento.closest(".tarjeta-admin"))).toBeNull();
  expect(await dialogo.evaluate((elemento) => elemento.parentElement?.parentElement === document.body)).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const caja = await dialogo.boundingBox();
  const viewport = page.viewportSize();
  expect(caja).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.y).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(viewport!.width);
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(viewport!.height);
}

test("Configuración modular conserva tabs, modales, temas, responsive y CRUD local", async () => {
  const app = await lanzarElectron("configuracion-modular");
  const respuestasFallidas: string[] = [];
  const erroresConsola: string[] = [];
  app.page.on("response", (respuesta) => {
    if (respuesta.url().startsWith(process.env.INDI_E2E_API_URL!) && respuesta.status() >= 400) {
      respuestasFallidas.push(`${respuesta.status()} ${new URL(respuesta.url()).pathname}`);
    }
  });
  app.page.on("console", (mensaje) => {
    if (mensaje.type() === "error") erroresConsola.push(mensaje.text());
  });

  try {
    await app.page.setViewportSize({ width: 1366, height: 768 });
    await login(app.page, "rh");
    await app.page.getByRole("link", { name: "Configuración" }).click();
    await expect(app.page.getByRole("heading", { name: "Configuración", exact: true })).toBeVisible();

    for (const tab of ["Datos de la obra", "Horarios", "Frentes", "Tipos de movimiento", "Tarifa hora extra", "Categorías"]) {
      await expect(app.page.getByRole("button", { name: tab })).toBeVisible();
    }
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const temaInicial = await app.page.evaluate(() => document.documentElement.dataset.theme);
    await app.page.getByRole("button", { name: /Cambiar a modo/ }).click();
    await expect.poll(() => app.page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(temaInicial);
    await app.page.getByRole("button", { name: /Cambiar a modo/ }).click();
    await expect.poll(() => app.page.evaluate(() => document.documentElement.dataset.theme)).toBe(temaInicial);

    await app.page.getByRole("button", { name: "Datos de la obra" }).click();
    await expect(app.page.getByLabel("Área / proyecto")).toBeDisabled();

    await app.page.getByRole("button", { name: "Horarios" }).click();
    await app.page.getByRole("button", { name: "+ Nuevo horario" }).click();
    await validarModalGlobal(app.page, "Nuevo horario");
    await app.page.locator(".configuracion-modal-backdrop").click({ position: { x: 4, y: 4 } });
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    expect(await app.page.evaluate(() => document.body.style.overflow)).toBe("");

    await app.page.getByRole("button", { name: "+ Nuevo horario" }).click();
    await app.page.keyboard.press("Escape");
    await expect(app.page.getByRole("dialog")).toHaveCount(0);

    await app.page.getByRole("button", { name: "+ Nuevo horario" }).click();
    let dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Horario QA modular");
    await dialogo.getByLabel("Hora de entrada").fill("07:00");
    await dialogo.getByLabel("Hora de salida").fill("16:00");
    await dialogo.getByLabel("Tolerancia (minutos)").fill("12");
    await dialogo.getByRole("button", { name: "Crear horario" }).click();
    let filaHorario = app.page.getByRole("row").filter({ hasText: "Horario QA modular" });
    await expect(filaHorario).toBeVisible();

    await app.page.setViewportSize({ width: 1920, height: 1080 });
    await filaHorario.getByRole("button", { name: "Editar" }).click();
    await validarModalGlobal(app.page, "Editar horario");
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Horario QA editado");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    filaHorario = app.page.getByRole("row").filter({ hasText: "Horario QA editado" });
    await expect(filaHorario).toBeVisible();

    await app.page.setViewportSize({ width: 1100, height: 720 });
    await app.page.getByRole("button", { name: "Frentes" }).click();
    await app.page.getByRole("button", { name: "+ Nuevo frente" }).click();
    await validarModalGlobal(app.page, "Nuevo frente");
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Frente QA modular");
    await dialogo.getByLabel("Tramo o ubicación de la obra").fill("Tramo QA inicial");
    await dialogo.getByLabel("Horario asignado").selectOption({ label: "Horario QA editado" });
    await dialogo.getByRole("checkbox", { name: "e2e-encargado_seccion" }).check();
    await dialogo.getByRole("checkbox", { name: /Ana Prueba E2E/ }).check();
    await dialogo.getByRole("button", { name: "Crear frente" }).click();
    let filaFrente = app.page.getByRole("row").filter({ hasText: "Frente QA modular" });
    await expect(filaFrente).toContainText("Tramo QA inicial");
    await expect(filaFrente).toContainText("Ana Prueba E2E");

    await filaFrente.getByRole("button", { name: "Editar" }).click();
    await validarModalGlobal(app.page, "Editar frente");
    dialogo = app.page.getByRole("dialog");
    await expect(dialogo.getByRole("checkbox", { name: "e2e-encargado_seccion" })).toBeChecked();
    await expect(dialogo.getByRole("checkbox", { name: /Ana Prueba E2E/ })).toBeChecked();
    await dialogo.getByRole("checkbox", { name: /Ana Prueba E2E/ }).uncheck();
    await dialogo.getByRole("checkbox", { name: /Bruno Prueba E2E/ }).check();
    await dialogo.getByLabel("Tramo o ubicación de la obra").fill("Tramo QA editado");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    filaFrente = app.page.getByRole("row").filter({ hasText: "Frente QA modular" });
    await expect(filaFrente).toContainText("Tramo QA editado");
    await expect(filaFrente).toContainText("Bruno Prueba E2E");
    await expect(filaFrente).not.toContainText("Ana Prueba E2E");

    await filaFrente.getByRole("button", { name: "Editar" }).click();
    dialogo = app.page.getByRole("dialog");
    await expect(dialogo.getByRole("checkbox", { name: /Bruno Prueba E2E/ })).toBeChecked();
    await dialogo.getByRole("checkbox", { name: /Bruno Prueba E2E/ }).uncheck();
    await dialogo.getByRole("checkbox", { name: "e2e-encargado_seccion" }).uncheck();
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    filaFrente = app.page.getByRole("row").filter({ hasText: "Frente QA modular" });
    await expect(filaFrente).toContainText("No asignado");

    await filaFrente.getByRole("button", { name: "Borrar" }).click();
    await app.page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(app.page.getByRole("row").filter({ hasText: "Frente QA modular" })).toHaveCount(0);

    await app.page.getByRole("button", { name: "Tipos de movimiento" }).click();
    await app.page.getByRole("button", { name: "+ Nuevo tipo" }).click();
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Movimiento QA modular");
    await dialogo.getByRole("checkbox", { name: "Es informativo" }).check();
    await dialogo.getByRole("button", { name: "Crear tipo" }).click();
    let filaTipo = app.page.getByRole("row").filter({ hasText: "Movimiento QA modular" });
    await expect(filaTipo).toBeVisible();
    await filaTipo.getByRole("button", { name: "Editar" }).click();
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Movimiento QA editado");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    filaTipo = app.page.getByRole("row").filter({ hasText: "Movimiento QA editado" });
    await expect(filaTipo).toBeVisible();
    await filaTipo.getByRole("button", { name: "Borrar" }).click();
    await app.page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(app.page.getByRole("row").filter({ hasText: "Movimiento QA editado" })).toHaveCount(0);

    await app.page.getByRole("button", { name: "Tarifa hora extra" }).click();
    await app.page.getByRole("button", { name: "+ Nueva tarifa" }).click();
    await validarModalGlobal(app.page, "Nueva tarifa de hora extra");
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Valor por hora").fill("123.45");
    await dialogo.getByLabel("Vigente desde").fill("2026-08-21");
    await dialogo.getByRole("button", { name: "Crear tarifa" }).click();
    await expect(app.page.getByText("$123.45")).toBeVisible();

    await app.page.getByRole("button", { name: "Categorías" }).click();
    await app.page.getByRole("button", { name: "+ Nueva categoría" }).click();
    await validarModalGlobal(app.page, "Nueva categoría");
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Nombre").fill("Categoría QA modular");
    await dialogo.getByLabel("Sueldo por defecto (opcional)").fill("777.50");
    await dialogo.getByRole("button", { name: "Crear categoría" }).click();
    let filaCategoria = app.page.getByRole("row").filter({ hasText: "Categoría QA modular" });
    await expect(filaCategoria).toContainText("$777.50");
    await filaCategoria.getByRole("button", { name: "Editar" }).click();
    dialogo = app.page.getByRole("dialog");
    await dialogo.getByLabel("Sueldo por defecto (opcional)").fill("888.50");
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
    filaCategoria = app.page.getByRole("row").filter({ hasText: "Categoría QA modular" });
    await expect(filaCategoria).toContainText("$888.50");
    await filaCategoria.getByRole("button", { name: "Borrar" }).click();
    await app.page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(app.page.getByRole("row").filter({ hasText: "Categoría QA modular" })).toHaveCount(0);

    await app.page.getByRole("button", { name: "Horarios" }).click();
    filaHorario = app.page.getByRole("row").filter({ hasText: "Horario QA editado" });
    await filaHorario.getByRole("button", { name: "Borrar" }).click();
    await app.page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
    await expect(app.page.getByRole("row").filter({ hasText: "Horario QA editado" })).toHaveCount(0);

    expect(respuestasFallidas).toEqual([]);
    expect(erroresConsola).toEqual([]);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await cerrar(app);
  }
});

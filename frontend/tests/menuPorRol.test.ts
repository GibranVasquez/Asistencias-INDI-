import { describe, expect, it } from "vitest";
import { menuPorRol, puedeAcceder, rutaInicialPara } from "../src/renderer/src/config/menuPorRol";

describe("guards de navegación por rol", () => {
  it("trabajador no tiene rutas del panel", () => expect(menuPorRol.trabajador).toEqual([]));
  it("recepción solo accede a asistencias", () => expect(menuPorRol.recepcion).toEqual(["asistencias"]));
  it("encargado solo accede a su vista operativa", () => expect(menuPorRol.encargado_seccion).toEqual(["encargado"]));
  it("RH puede acceder a nómina y trabajadores", () => {
    expect(puedeAcceder("rh", "nomina")).toBe(true);
    expect(puedeAcceder("rh", "trabajadores")).toBe(true);
  });
  it("administrador no accede a nómina ni trabajadores", () => {
    expect(puedeAcceder("administrador", "nomina")).toBe(false);
    expect(puedeAcceder("administrador", "trabajadores")).toBe(false);
  });
  it("elige la primera ruta permitida como inicio", () => {
    expect(rutaInicialPara("recepcion")).toBe("asistencias");
    expect(rutaInicialPara("encargado_seccion")).toBe("encargado");
    expect(rutaInicialPara("administrador")).toBe("dashboard");
  });
});

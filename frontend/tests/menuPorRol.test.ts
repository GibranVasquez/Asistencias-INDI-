import { describe, expect, it } from "vitest";
import { etiquetaNavegacion, menuPorRol, puedeAcceder, rutaInicialPara } from "@/routes/navigationConfig";

describe("guards de navegación por rol", () => {
  const rutas = (rol: Parameters<typeof menuPorRol>[0]) => menuPorRol(rol).map((item) => item.id);

  it("trabajador no tiene rutas del panel", () => expect(rutas("trabajador")).toEqual([]));
  it("recepción solo accede a asistencias", () => expect(rutas("recepcion")).toEqual(["asistencias"]));
  it("encargado solo accede a su vista operativa", () => expect(rutas("encargado_seccion")).toEqual(["encargado"]));
  it("RH puede acceder a nómina y trabajadores", () => {
    expect(puedeAcceder("rh", "nomina")).toBe(true);
    expect(puedeAcceder("rh", "trabajadores")).toBe(true);
    expect(puedeAcceder("rh", "incidencias")).toBe(true);
    expect(puedeAcceder("rh", "auditoria")).toBe(false);
    expect(etiquetaNavegacion(menuPorRol("rh").find((item) => item.id === "encargado")!, "rh")).toBe("Responsables por frente");
  });
  it("administrador no accede a nómina ni trabajadores", () => {
    expect(puedeAcceder("administrador", "nomina")).toBe(false);
    expect(puedeAcceder("administrador", "trabajadores")).toBe(false);
    expect(puedeAcceder("administrador", "incidencias")).toBe(true);
    expect(puedeAcceder("administrador", "auditoria")).toBe(true);
    expect(etiquetaNavegacion(menuPorRol("administrador").find((item) => item.id === "encargado")!, "administrador")).toBe("Responsables por frente");
  });
  it("el encargado conserva la etiqueta de su vista personal", () => {
    expect(etiquetaNavegacion(menuPorRol("encargado_seccion")[0], "encargado_seccion")).toBe("Mi frente");
  });
  it("elige la primera ruta permitida como inicio", () => {
    expect(rutaInicialPara("recepcion")).toBe("asistencias");
    expect(rutaInicialPara("encargado_seccion")).toBe("encargado");
    expect(rutaInicialPara("administrador")).toBe("dashboard");
  });

  it("organiza RH por operación, supervisión y administración sin ampliar permisos", () => {
    expect(menuPorRol("rh").map(({ id, group }) => [id, group])).toEqual([
      ["dashboard", "general"], ["trabajadores", "operacion"], ["asistencias", "operacion"],
      ["nomina", "operacion"], ["reportes", "operacion"], ["encargado", "operacion"],
      ["incidencias", "supervision"], ["configuracion", "administracion"],
    ]);
  });
});

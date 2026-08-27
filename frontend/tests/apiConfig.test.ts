import { describe, expect, it } from "vitest";
import { extraerApiBaseUrl, validarApiBaseUrl, urlApiPorDefecto } from "../src/main/apiConfigValidation";

describe("configuración de URL de la API", () => {
  it.each([
    "http://localhost:4000",
    "http://127.0.0.1:44100",
    "https://api.example.invalid/v1",
  ])("acepta una URL absoluta HTTP/HTTPS sin conectarse: %s", (url) => {
    expect(validarApiBaseUrl(url)).toBe(url);
  });

  it("normaliza únicamente espacios exteriores", () => {
    expect(validarApiBaseUrl("  http://localhost:4000  ")).toBe("http://localhost:4000");
  });

  it.each([
    "",
    "api.example.invalid",
    "/api",
    "ftp://api.example.invalid",
    "file:///tmp/api",
    "https://usuario:password@api.example.invalid",
    "http://",
  ])("rechaza una URL inválida sin incluir su valor en el error", (valor) => {
    expect(() => validarApiBaseUrl(valor)).toThrow("apiBaseUrl debe ser una URL absoluta HTTP o HTTPS válida.");
    try {
      validarApiBaseUrl(valor);
    } catch (error) {
      if (valor) expect((error as Error).message).not.toContain(valor);
    }
  });

  it("permite omitir apiBaseUrl para conservar el valor por defecto", () => {
    expect(extraerApiBaseUrl({ _comentario: "plantilla local" })).toBeUndefined();
  });

  it.each([null, [], "config", 42])("rechaza config.json con formato no objeto", (config) => {
    expect(() => extraerApiBaseUrl(config)).toThrow("config.json debe contener un objeto de configuración válido.");
  });

  it("usa localhost como fallback de desarrollo", () => {
    expect(urlApiPorDefecto(false)).toBe("http://localhost:4000");
  });

  it("usa la API pública como fallback de producción empaquetada", () => {
    expect(urlApiPorDefecto(true)).toBe("https://api.sistemasindi.com");
  });

  it("permite override explícito desde config.json", () => {
    expect(extraerApiBaseUrl({ apiBaseUrl: "https://api.sistemasindi.com" })).toBe("https://api.sistemasindi.com");
  });
});

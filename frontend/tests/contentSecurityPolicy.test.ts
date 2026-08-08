import { describe, expect, it } from "vitest";
import {
  construirContentSecurityPolicy,
  esNavegacionAlMismoDocumento,
} from "../src/main/contentSecurityPolicy";

describe("Content Security Policy de Electron", () => {
  it("limita producción al origen real de la API y recursos locales", () => {
    const csp = construirContentSecurityPolicy({ apiBaseUrl: "https://api.example.test/v1", desarrollo: false });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' https://api.example.test");
    expect(csp).toContain("font-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("script-src *");
    expect(csp).not.toContain("connect-src *");
    expect(csp).not.toContain("localhost");
  });

  it("permite HMR local únicamente en desarrollo", () => {
    const csp = construirContentSecurityPolicy({ apiBaseUrl: "http://localhost:4000", desarrollo: true });
    expect(csp).toContain("http://localhost:*");
    expect(csp).toContain("ws://localhost:*");
  });
});

describe("navegación de la ventana", () => {
  it("permite cambios de hash del documento actual", () => {
    expect(esNavegacionAlMismoDocumento("file:///app/index.html#/login", "file:///app/index.html#/kiosco")).toBe(true);
  });

  it("rechaza navegación a documentos u orígenes externos", () => {
    expect(esNavegacionAlMismoDocumento("file:///app/index.html", "https://example.test/")).toBe(false);
    expect(esNavegacionAlMismoDocumento("https://localhost:5173/", "https://localhost:5173/otro")).toBe(false);
  });
});

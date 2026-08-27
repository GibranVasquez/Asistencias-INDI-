import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exigirHostLocal } from "../src/config/hostGuard";
import { validarVariablesDeEntorno } from "../src/config/env";
import { obtenerOrigensPermitidos, origenPermitido, ORIGEN_ELECTRON_DESARROLLO } from "../src/config/cors";

const ENTORNO_ORIGINAL = { ...process.env };

function fijarEntorno(vars: Record<string, string | undefined>): void {
  process.env = { ...ENTORNO_ORIGINAL };
  for (const [nombre, valor] of Object.entries(vars)) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
}

describe("exigirHostLocal — allowlist local", () => {
  beforeEach(() => fijarEntorno({ NODE_ENV: "development", DATABASE_URL: undefined, DIRECT_URL: undefined }));
  afterEach(() => {
    process.env = { ...ENTORNO_ORIGINAL };
    vi.restoreAllMocks();
  });

  for (const url of [
    "postgresql://u:p@localhost/db",
    "postgresql://u:p@localhost:55432/db",
    "postgresql://u:p@127.0.0.1/db",
    "postgresql://u:p@127.0.0.1:55432/db",
    "  postgresql://u:p%40ss%3Aword@LOCALHOST:55432/db?schema=public&sslmode=disable  ",
  ]) {
    it(`acepta host local: ${new URL(url.trim()).host}`, () => {
      process.env.DATABASE_URL = url;
      expect(() => exigirHostLocal("DATABASE_URL")).not.toThrow();
    });
  }

  for (const host of [
    "db.external.invalid",
    "8.8.8.8",
    "db.ejemplo.invalid",
    "proyecto-ficticio.supabase.co",
    "instancia-ficticia.rds.amazonaws.com",
    "localhost.evil.com",
    "127.0.0.1.evil.com",
  ]) {
    it(`rechaza host no local: ${host}`, () => {
      process.env.DATABASE_URL = `postgresql://u:p@${host}:5432/db`;
      expect(() => exigirHostLocal("DATABASE_URL")).toThrow(host);
    });
  }

  it("rechaza una URL inválida (fail-closed)", () => {
    process.env.DATABASE_URL = "no-es-url";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("URL PostgreSQL válida");
  });

  it("rechaza hostname vacío", () => {
    process.env.DATABASE_URL = "postgresql:///db";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("host externo");
  });

  it("rechaza un host externo efectivo indicado mediante query", () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db?host=db.external.invalid";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("db.external.invalid");
  });

  it("rechaza protocolos ajenos aunque el host sea localhost", () => {
    process.env.DATABASE_URL = "https://localhost:55432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("protocolo PostgreSQL");
  });

  it("rechaza ::1 porque la allowlist actual no incluye IPv6", () => {
    process.env.DATABASE_URL = "postgresql://u:p@[::1]:55432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("[::1]");
  });

  it("bloquea un host externo cuando NODE_ENV está ausente", () => {
    delete process.env.NODE_ENV;
    process.env.DATABASE_URL = "postgresql://u:p@db.external.invalid:5432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("db.external.invalid");
  });

  it("bloquea un host externo en test", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://u:p@db.external.invalid:5432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).toThrow("db.external.invalid");
  });

  it("permite la base efímera local en test", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:55432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).not.toThrow();
  });

  it("permite un host externo ficticio en producción sin conectarse", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://u:p@db.external.invalid:5432/db";
    expect(() => exigirHostLocal("DATABASE_URL")).not.toThrow();
  });

  it("valida variables relacionadas como DIRECT_URL", () => {
    process.env.DIRECT_URL = "postgresql://u:p@db.external.invalid:5432/db";
    expect(() => exigirHostLocal("DIRECT_URL")).toThrow("DIRECT_URL");
  });

  it("no revela credenciales ni query string en el error", () => {
    const marcadorSecreto = "secreto-ficticio-no-mostrar";
    process.env.DATABASE_URL = `postgresql://usuario:${marcadorSecreto}@db.external.invalid:5432/db?token=${marcadorSecreto}`;
    try {
      exigirHostLocal("DATABASE_URL");
      throw new Error("La guarda debió rechazar el host externo.");
    } catch (error) {
      expect((error as Error).message).toContain("db.external.invalid");
      expect((error as Error).message).not.toContain(marcadorSecreto);
    }
  });

  it("permite omitir la variable para comandos sin conexión como prisma generate", () => {
    expect(() => exigirHostLocal("DATABASE_URL")).not.toThrow();
  });
});

describe("validarVariablesDeEntorno — integración del guard", () => {
  const BASE = { JWT_SECRET: "test-secret", ALLOWED_ORIGIN: "http://localhost:5173" };

  afterEach(() => {
    process.env = { ...ENTORNO_ORIGINAL };
    vi.restoreAllMocks();
  });

  it("bloquea host externo en desarrollo", () => {
    fijarEntorno({ ...BASE, DATABASE_URL: "postgresql://u:p@db.external.invalid:5432/db", NODE_ENV: "development" });
    expect(() => validarVariablesDeEntorno()).toThrow("db.external.invalid");
  });

  it("acepta localhost en desarrollo", () => {
    fijarEntorno({ ...BASE, DATABASE_URL: "postgresql://u:p@localhost:5432/db", NODE_ENV: "development" });
    expect(() => validarVariablesDeEntorno()).not.toThrow();
  });

  it("falla sin DATABASE_URL según el contrato del servidor", () => {
    fijarEntorno({ ...BASE, DATABASE_URL: undefined, NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    validarVariablesDeEntorno();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe("CORS — allowlist explícita", () => {
  it("permite Electron desarrollo y conserva el origin configurado", () => {
    expect(obtenerOrigensPermitidos("https://api.example.invalid")).toEqual([
      ORIGEN_ELECTRON_DESARROLLO,
      "https://api.example.invalid",
    ]);
    expect(origenPermitido(ORIGEN_ELECTRON_DESARROLLO, obtenerOrigensPermitidos("https://api.example.invalid"))).toBe(true);
  });

  it("rechaza origins no autorizados y no usa wildcard", () => {
    const permitidos = obtenerOrigensPermitidos("https://api.example.invalid");
    expect(origenPermitido("https://evil.example.invalid", permitidos)).toBe(false);
    expect(permitidos).not.toContain("*");
  });

  it("acepta requests sin Origin para tráfico no-browser", () => {
    expect(origenPermitido(undefined, obtenerOrigensPermitidos("https://api.example.invalid"))).toBe(true);
  });
});

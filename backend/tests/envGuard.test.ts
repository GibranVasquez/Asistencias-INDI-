import { afterEach, describe, expect, it, vi } from "vitest";
import { exigirHostLocal } from "../src/config/hostGuard";
import { validarVariablesDeEntorno } from "../src/config/env";

function conEntorno(vars: Record<string, string | undefined>) {
  const original = { ...process.env };
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return {
    restaurar: () => {
      process.env = original;
    },
  };
}

describe("exigirHostLocal — allowlist localhost/127.0.0.1", () => {
  afterEach(() => vi.restoreAllMocks());

  it("acepta localhost", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@localhost:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("acepta 127.0.0.1", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("rechaza hostname externo genérico (.invalid)", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@db.external.invalid:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("db.external.invalid"));
    restaurar();
  });

  it("rechaza IP externa", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@8.8.8.8:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("8.8.8.8"));
    restaurar();
  });

  it("rechaza hostname genérico externo", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@db.ejemplo.com:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("db.ejemplo.com"));
    restaurar();
  });

  it("rechaza Supabase pooler", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).toHaveBeenCalledWith(1);
    restaurar();
  });

  it("rechaza RDS", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@db.xxxxx.rds.amazonaws.com:5432/db", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).toHaveBeenCalledWith(1);
    restaurar();
  });

  it("omite la validación en producción", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/db", NODE_ENV: "production" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("omite la validación en test", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/db", NODE_ENV: "test" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("no falla si la variable no está definida", () => {
    const { restaurar } = conEntorno({ NODE_ENV: "development" });
    delete process.env.DATABASE_URL;
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("no falla con URL malformada", () => {
    const { restaurar } = conEntorno({ DATABASE_URL: "no-es-url", NODE_ENV: "development" });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    exigirHostLocal("DATABASE_URL");
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });
});

describe("validarVariablesDeEntorno — integra el guard", () => {
  const BASE = { JWT_SECRET: "test-secret", ALLOWED_ORIGIN: "http://localhost:5173" };

  afterEach(() => vi.restoreAllMocks());

  it("bloquea host externo en desarrollo vía validarVariablesDeEntorno", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@db.ejemplo.com:5432/db",
      NODE_ENV: "development",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    validarVariablesDeEntorno();
    expect(process.exit).toHaveBeenCalledWith(1);
    restaurar();
  });

  it("acepta localhost en desarrollo vía validarVariablesDeEntorno", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@localhost:5432/indi_asistencia",
      NODE_ENV: "development",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    validarVariablesDeEntorno();
    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });
});

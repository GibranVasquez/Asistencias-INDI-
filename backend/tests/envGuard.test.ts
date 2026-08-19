import { afterEach, describe, expect, it, vi } from "vitest";
import { validarVariablesDeEntorno } from "../src/config/env";

function conEntorno(vars: Record<string, string>) {
  const original = { ...process.env };
  Object.assign(process.env, vars);
  return {
    restaurar: () => {
      process.env = original;
    },
  };
}

describe("validarVariablesDeEntorno — guard de DATABASE_URL externa", () => {
  const BASE = {
    JWT_SECRET: "test-secret",
    ALLOWED_ORIGIN: "http://localhost:5173",
  };

  afterEach(() => vi.restoreAllMocks());

  it("permite localhost en desarrollo", () => {
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

  it("permite 127.0.0.1 en desarrollo", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/indi_asistencia",
      NODE_ENV: "development",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("bloquea Supabase en desarrollo", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/postgres",
      NODE_ENV: "development",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("supabase.co")
    );
    restaurar();
  });

  it("bloquea RDS en desarrollo", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@db.xxxxx.rds.amazonaws.com:5432/prod",
      NODE_ENV: "development",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("rds.amazonaws.com")
    );
    restaurar();
  });

  it("permite hosts externos en producción", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/postgres",
      NODE_ENV: "production",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("permite hosts externos en test", () => {
    const { restaurar } = conEntorno({
      ...BASE,
      DATABASE_URL: "postgresql://u:p@db.supabase.co:5432/postgres",
      NODE_ENV: "test",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).not.toHaveBeenCalled();
    restaurar();
  });

  it("crashea sin DATABASE_URL", () => {
    const { restaurar } = conEntorno({
      JWT_SECRET: "test-secret",
      ALLOWED_ORIGIN: "http://localhost:5173",
      NODE_ENV: "development",
    });
    delete process.env.DATABASE_URL;
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    validarVariablesDeEntorno();

    expect(process.exit).toHaveBeenCalledWith(1);
    restaurar();
  });
});

import { describe, expect, it } from "vitest";
import { crearConfiguracionConexionPrisma } from "../src/config/prismaTls";

describe("selector TLS de Prisma", () => {
  for (const url of [
    "postgresql://u:p@localhost/db",
    "postgresql://u:p@127.0.0.1/db",
    "postgresql://u:p@127.0.0.1:55432/indi_test?sslmode=require",
  ]) {
    it(`deshabilita TLS para ${new URL(url).host}`, () => {
      expect(crearConfiguracionConexionPrisma(url).ssl).toBe(false);
    });
  }

  for (const host of ["db.external.invalid", "localhost.evil.com", "127.0.0.1.evil.com"]) {
    it(`conserva TLS estricto para ${host}`, () => {
      const configuracion = crearConfiguracionConexionPrisma(
        `postgresql://u:p@${host}:5432/db?sslmode=disable`,
        "ca-ficticia"
      );
      expect(configuracion.ssl).toEqual({ rejectUnauthorized: true, ca: "ca-ficticia" });
      expect(configuracion.connectionString).not.toContain("sslmode");
    });
  }

  it("rechaza un host externo si no se proporciona CA", () => {
    expect(() => crearConfiguracionConexionPrisma("postgresql://u:p@db.external.invalid:5432/db")).toThrow(
      "requiere una CA"
    );
  });

  it("no permite que ?host= desvíe una URL local a un host externo", () => {
    expect(() =>
      crearConfiguracionConexionPrisma("postgresql://u:p@localhost:5432/db?host=db.external.invalid")
    ).toThrow("requiere una CA");
  });
});

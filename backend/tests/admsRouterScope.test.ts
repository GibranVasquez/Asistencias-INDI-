import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Esta prueba valida exclusivamente el montaje y alcance HTTP del router
// ADMS. No debe inicializar Prisma ni depender de DATABASE_URL.
vi.mock("../src/utils/prisma", () => ({
  prisma: { terminal: { findUnique: vi.fn().mockResolvedValue({ id: "terminal-e2e", activo: true, numeroSerie: "SN-E2E", tipo: "adms" }) } },
}));
vi.mock("../src/config/env", () => ({ validarVariablesDeEntorno: vi.fn() }));

import { app } from "../src/app";

const allowlistOriginal = process.env.ADMS_IPS_PERMITIDAS;

afterEach(() => {
  if (allowlistOriginal === undefined) delete process.env.ADMS_IPS_PERMITIDAS;
  else process.env.ADMS_IPS_PERMITIDAS = allowlistOriginal;
});

describe("alcance de la allowlist ADMS", () => {
  it("no bloquea rutas ajenas a /iclock aunque la IP no esté permitida", async () => {
    process.env.ADMS_IPS_PERMITIDAS = "203.0.113.10";
    const respuesta = await request(app).get("/health");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ status: "ok", maintenance: false });
  });

  it("continúa bloqueando /iclock para una IP fuera de la allowlist", async () => {
    process.env.ADMS_IPS_PERMITIDAS = "203.0.113.10";
    const respuesta = await request(app).get("/iclock/cdata?SN=SN-E2E");
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe("Acceso no permitido desde esta red.");
  });

  it("permite una terminal conocida cuando la allowlist está vacía", async () => {
    delete process.env.ADMS_IPS_PERMITIDAS;
    const registry = await request(app).get("/iclock/registry?SN=SN-E2E");
    const devicecmd = await request(app).post("/iclock/devicecmd?SN=SN-E2E").type("text/plain").send("");
    expect(registry.status).toBe(200);
    expect(devicecmd.status).toBe(200);
  });

  it("rechaza SN desconocido en registry y devicecmd", async () => {
    delete process.env.ADMS_IPS_PERMITIDAS;
    const { prisma } = await import("../src/utils/prisma");
    vi.mocked(prisma.terminal.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const registry = await request(app).get("/iclock/registry?SN=SN-FALSO");
    const devicecmd = await request(app).post("/iclock/devicecmd?SN=SN-FALSO").type("text/plain").send("");
    expect(registry.status).toBe(403);
    expect(devicecmd.status).toBe(403);
  });

  it("rechaza terminal inactiva en registry y devicecmd", async () => {
    delete process.env.ADMS_IPS_PERMITIDAS;
    const { prisma } = await import("../src/utils/prisma");
    vi.mocked(prisma.terminal.findUnique).mockResolvedValueOnce({ id: "terminal-e2e", activo: false, numeroSerie: "SN-E2E", tipo: "adms" } as never)
      .mockResolvedValueOnce({ id: "terminal-e2e", activo: false, numeroSerie: "SN-E2E", tipo: "adms" } as never);
    const registry = await request(app).get("/iclock/registry?SN=SN-E2E");
    const devicecmd = await request(app).post("/iclock/devicecmd?SN=SN-E2E").type("text/plain").send("");
    expect(registry.status).toBe(403);
    expect(devicecmd.status).toBe(403);
  });
});

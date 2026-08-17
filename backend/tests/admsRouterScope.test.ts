import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Esta prueba valida exclusivamente el montaje y alcance HTTP del router
// ADMS. No debe inicializar Prisma ni depender de DATABASE_URL.
vi.mock("../src/utils/prisma", () => ({ prisma: {} }));
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
    expect(respuesta.body).toEqual({ status: "ok" });
  });

  it("continúa bloqueando /iclock para una IP fuera de la allowlist", async () => {
    process.env.ADMS_IPS_PERMITIDAS = "203.0.113.10";
    const respuesta = await request(app).get("/iclock/cdata?SN=SN-E2E");
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe("Acceso no permitido desde esta red.");
  });
});

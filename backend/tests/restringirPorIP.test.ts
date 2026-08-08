import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { restringirPorIP } from "../src/middlewares/restringirPorIP";

afterEach(() => {
  delete process.env.ADMS_IPS_PERMITIDAS;
  process.env.NODE_ENV = "test";
  vi.restoreAllMocks();
});

describe("allowlist ADMS", () => {
  it("falla cerrado en producción cuando no hay allowlist", async () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/iclock/cdata", restringirPorIP, (_req, res) => res.send("OK"));
    const respuesta = await request(app).get("/iclock/cdata");
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: "Acceso no permitido." });
  });
});

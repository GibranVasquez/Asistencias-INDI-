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
  it("no bloquea en producción cuando no hay allowlist", async () => {
    process.env.NODE_ENV = "production";
    const app = express();
    app.get("/iclock/cdata", restringirPorIP, (_req, res) => res.send("OK"));
    const respuesta = await request(app).get("/iclock/cdata");
    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toBe("OK");
  });

  it("ignora comodines y CIDR en la configuración", async () => {
    process.env.NODE_ENV = "production";
    process.env.ADMS_IPS_PERMITIDAS = "*,0.0.0.0/0,any";
    const app = express();
    app.get("/iclock/cdata", restringirPorIP, (_req, res) => res.send("OK"));
    const respuesta = await request(app).get("/iclock/cdata");
    expect(respuesta.status).toBe(200);
  });
});

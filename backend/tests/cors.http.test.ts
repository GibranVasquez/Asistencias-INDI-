import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { crearOpcionesCors } from "../src/config/cors";

function appCors() {
  const app = express();
  app.use(cors(crearOpcionesCors()));
  app.post("/auth/login", (_req, res) => res.json({ ok: true }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("CORS de Electron", () => {
  it("permite localhost:5174", async () => {
    const respuesta = await request(appCors()).get("/health").set("Origin", "http://localhost:5174");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
  });

  it("rechaza origins no autorizados sin wildcard", async () => {
    const respuesta = await request(appCors()).get("/health").set("Origin", "https://evil.example");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["access-control-allow-origin"]).toBeUndefined();
    expect(respuesta.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("rechaza Origin null del renderer empaquetado", async () => {
    const respuesta = await request(appCors()).get("/health").set("Origin", "null");
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde el preflight OPTIONS permitido", async () => {
    const respuesta = await request(appCors())
      .options("/auth/login")
      .set("Origin", "http://localhost:5174")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(respuesta.status).toBe(204);
    expect(respuesta.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    expect(respuesta.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("mantiene login POST y health con CORS", async () => {
    const login = await request(appCors()).post("/auth/login").set("Origin", "http://localhost:5174").send({ username: "u", password: "p" });
    const health = await request(appCors()).get("/health").set("Origin", "http://localhost:5174");
    expect(login.status).toBe(200);
    expect(health.status).toBe(200);
    expect(health.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
  });
});

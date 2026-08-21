import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { RolUsuario } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ usuario: vi.fn(), terminal: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: { usuario: { findUnique: mocks.usuario }, terminal: { findUnique: mocks.terminal } } }));

import { authMiddleware } from "../src/middlewares/auth.middleware";
import { permitirTerminalOUsuarioConRol } from "../src/middlewares/authTerminalOUsuario";
import { terminalAuthMiddleware } from "../src/middlewares/terminalAuthMiddleware";
import { permitirRoles } from "../src/middlewares/role.middleware";

const secret = "secreto-pruebas-local-123";
const humano = () => jwt.sign({ usuarioId: "u1", rol: RolUsuario.rh, trabajadorId: null }, secret);
const admin = () => jwt.sign({ usuarioId: "u2", rol: RolUsuario.administrador, trabajadorId: null }, secret);
const recepcion = () => jwt.sign({ usuarioId: "u3", rol: RolUsuario.recepcion, trabajadorId: null }, secret);
const terminal = () => jwt.sign({ terminalId: "term-1" }, secret);

function appPrueba() {
  const app = express();
  app.get("/finanzas", authMiddleware, permitirRoles(RolUsuario.rh), (_req, res) => res.json({ ok: true }));
  app.get("/humano", authMiddleware, (_req, res) => res.json({ ok: true }));
  app.get("/terminal", terminalAuthMiddleware, (_req, res) => res.json({ ok: true }));
  app.get("/catalogo", permitirTerminalOUsuarioConRol(RolUsuario.rh, RolUsuario.administrador), (_req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  mocks.usuario.mockImplementation(async ({ where }) => ({ id: where.id, activo: true }));
  mocks.terminal.mockResolvedValue({ id: "term-1", activo: true });
});

describe("autenticación y roles HTTP", () => {
  it("acepta un JWT humano válido de RH", async () => expect(request(appPrueba()).get("/finanzas").set("Authorization", `Bearer ${humano()}`)).resolves.toMatchObject({ status: 200 }));
  it("rechaza acceso sin JWT", async () => expect(request(appPrueba()).get("/humano")).resolves.toMatchObject({ status: 401, body: { error: "No autorizado." } }));
  it("rechaza un JWT inválido", async () => expect(request(appPrueba()).get("/humano").set("Authorization", "Bearer alterado")).resolves.toMatchObject({ status: 401 }));
  it("impide al administrador acceder a una ruta financiera RH-only", async () => expect(request(appPrueba()).get("/finanzas").set("Authorization", `Bearer ${admin()}`)).resolves.toMatchObject({ status: 403 }));
  it("impide usar token de Terminal como token humano", async () => expect(request(appPrueba()).get("/humano").set("Authorization", `Bearer ${terminal()}`)).resolves.toMatchObject({ status: 401 }));
  it("impide usar token humano como token de Terminal", async () => expect(request(appPrueba()).get("/terminal").set("Authorization", `Bearer ${humano()}`)).resolves.toMatchObject({ status: 401 }));
});

describe("autenticación combinada de Terminal o Usuario", () => {
  it("permite un usuario activo con rol autorizado", async () => {
    await expect(request(appPrueba()).get("/catalogo").set("Authorization", `Bearer ${humano()}`)).resolves.toMatchObject({ status: 200 });
  });

  it("rechaza un usuario activo con rol no autorizado", async () => {
    await expect(request(appPrueba()).get("/catalogo").set("Authorization", `Bearer ${recepcion()}`)).resolves.toMatchObject({
      status: 403,
      body: { error: "No tienes permiso para realizar esta acción." },
    });
  });

  it("rechaza un usuario desactivado después de emitir su JWT", async () => {
    mocks.usuario.mockResolvedValueOnce({ id: "u1", activo: false });

    await expect(request(appPrueba()).get("/catalogo").set("Authorization", `Bearer ${humano()}`)).resolves.toMatchObject({
      status: 401,
      body: { error: "No autorizado." },
    });
  });

  it("rechaza un JWT inválido", async () => {
    await expect(request(appPrueba()).get("/catalogo").set("Authorization", "Bearer alterado")).resolves.toMatchObject({
      status: 401,
      body: { error: "No autorizado." },
    });
  });

  it("conserva el acceso de un Terminal activo", async () => {
    await expect(request(appPrueba()).get("/catalogo").set("Authorization", `Bearer ${terminal()}`)).resolves.toMatchObject({ status: 200 });
  });

  it("rechaza un Terminal inactivo", async () => {
    mocks.terminal.mockResolvedValueOnce({ id: "term-1", activo: false });

    await expect(request(appPrueba()).get("/catalogo").set("Authorization", `Bearer ${terminal()}`)).resolves.toMatchObject({
      status: 401,
      body: { error: "No autorizado." },
    });
  });
});

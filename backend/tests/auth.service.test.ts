import bcrypt from "bcrypt";
import { RolUsuario } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ buscar: vi.fn(), actualizar: vi.fn(), transaction: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: { usuario: { findUnique: mocks.buscar, update: mocks.actualizar }, $transaction: mocks.transaction } }));
import { iniciarSesion } from "../src/services/auth.service";

const password = "Prueba123";
let hash: string;
beforeEach(async () => {
  process.env.JWT_SECRET = "secreto-local-tests";
  hash = await bcrypt.hash(password, 4);
  mocks.buscar.mockResolvedValue({ id: "u1", username: "rh-test", passwordHash: hash, rol: RolUsuario.rh, trabajadorId: null, activo: true, intentosFallidos: 0, bloqueadoHasta: null, requiereCambioPassword: false, creadoEn: new Date(), actualizadoEn: new Date(), seccionesAsignadas: [] });
});

describe("login", () => {
  it("devuelve token y usuario con credenciales correctas", async () => {
    const resultado = await iniciarSesion("rh-test", password);
    expect(resultado.token).toEqual(expect.any(String));
    expect(resultado.usuario).toMatchObject({ id: "u1", username: "rh-test", rol: RolUsuario.rh });
  });
  it("usa respuesta genérica para contraseña incorrecta", async () => {
    mocks.transaction.mockImplementation(async () => undefined);
    await expect(iniciarSesion("rh-test", "Incorrecta9")).rejects.toMatchObject({ status: 401, message: "Usuario o contraseña incorrectos." });
  });
  it("usa la misma respuesta genérica para usuario inexistente", async () => {
    mocks.buscar.mockResolvedValue(null);
    await expect(iniciarSesion("nadie", "Incorrecta9")).rejects.toMatchObject({ status: 401, message: "Usuario o contraseña incorrectos." });
  });
  it("no emite sesión administrativa para una cuenta trabajador", async () => {
    mocks.buscar.mockResolvedValue({ id: "u2", username: "trabajador-test", passwordHash: hash, rol: RolUsuario.trabajador, trabajadorId: "t1", activo: true, intentosFallidos: 0, bloqueadoHasta: null, requiereCambioPassword: false, creadoEn: new Date(), actualizadoEn: new Date(), seccionesAsignadas: [] });
    await expect(iniciarSesion("trabajador-test", password)).rejects.toMatchObject({
      status: 403,
      message: "Esta cuenta no tiene acceso al panel administrativo.",
    });
  });
});

import { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middlewares/errorHandler";
import { AppError } from "../src/utils/AppError";

function respuestaFicticia() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { respuesta: { status } as unknown as Response, status, json };
}

describe("errorHandler", () => {
  afterEach(() => vi.restoreAllMocks());

  it("no expone detalles internos de errores desconocidos en desarrollo", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { respuesta, status, json } = respuestaFicticia();
    const errorInterno = new Error("getaddrinfo EAI_AGAIN proveedor-privado.example");

    errorHandler(errorInterno, {} as Request, respuesta, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Error interno del servidor" });
    expect(JSON.stringify(json.mock.calls)).not.toContain("proveedor-privado.example");
  });

  it("conserva mensajes controlados de reglas de aplicación", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { respuesta, status, json } = respuestaFicticia();

    errorHandler(new AppError(401, "Usuario o contraseña incorrectos."), {} as Request, respuesta, vi.fn() as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "Usuario o contraseña incorrectos." });
  });
});

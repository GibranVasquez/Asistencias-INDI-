import { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ buscarTerminal: vi.fn(), actualizarTerminal: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({
  prisma: { terminal: { findUnique: mocks.buscarTerminal, update: mocks.actualizarTerminal } },
}));

import { handshake } from "../src/controllers/adms.controller";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("handshake ADMS", () => {
  it("envía el offset actual de la zona IANA asociada a la terminal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T15:00:00Z"));
    mocks.buscarTerminal.mockResolvedValue({ id: "terminal-1", activo: true, numeroSerie: "SN-LOCAL" });
    mocks.actualizarTerminal.mockResolvedValue({ obra: { timezoneObra: "America/Matamoros" } });
    const respuesta = { type: vi.fn().mockReturnThis(), send: vi.fn() };

    await handshake(
      { query: { SN: "SN-LOCAL" } } as unknown as Request,
      respuesta as unknown as Response
    );

    expect(mocks.actualizarTerminal).toHaveBeenCalledWith(expect.objectContaining({
      select: { obra: { select: { timezoneObra: true } } },
    }));
    expect(respuesta.send).toHaveBeenCalledWith(expect.stringContaining("\nTimeZone=-5\n"));
  });

  it("omite TimeZone cuando la obra no tiene zona horaria", async () => {
    mocks.buscarTerminal.mockResolvedValue({ id: "terminal-1", activo: true, numeroSerie: "SN-LOCAL" });
    mocks.actualizarTerminal.mockResolvedValue({ obra: { timezoneObra: null } });
    const respuesta = { type: vi.fn().mockReturnThis(), send: vi.fn() };

    await handshake(
      { query: { SN: "SN-LOCAL" } } as unknown as Request,
      respuesta as unknown as Response
    );

    expect(respuesta.send).toHaveBeenCalledOnce();
    expect(respuesta.send.mock.calls[0][0]).not.toContain("TimeZone=");
  });
});

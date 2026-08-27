import { MetodoAsistencia, Prisma, TrabajadorEstatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ trabajador: vi.fn(), seccion: vi.fn(), terminal: vi.fn(), obraCount: vi.fn(), crear: vi.fn(), buscar: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: {
  trabajador: { findUnique: mocks.trabajador },
  seccion: { findUnique: mocks.seccion },
  terminal: { findUnique: mocks.terminal },
  obra: { count: mocks.obraCount },
  asistenciaDiaria: { create: mocks.crear, findFirst: mocks.buscar },
} }));

import { registrarAsistencia } from "../src/services/asistencia.service";

const base = { fecha: "2026-08-08", hora: "08:00", seccionId: "seccion-hoy", turno: "Matutino", metodoUsado: MetodoAsistencia.huella };

beforeEach(() => {
  mocks.trabajador.mockResolvedValue({ id: "t1", estatus: TrabajadorEstatus.activo });
  mocks.seccion.mockResolvedValue({ id: "seccion-hoy", obraId: "obra-1" });
  mocks.terminal.mockResolvedValue({ activo: true, obraId: "obra-1" });
  mocks.obraCount.mockResolvedValue(1);
  mocks.crear.mockImplementation(async ({ data }) => ({ id: "a1", ...data }));
});

describe("registro de asistencia", () => {
  it("persiste una marcación válida con la sección del día", async () => {
    await registrarAsistencia("t1", "terminal-1", base);
    expect(mocks.crear).toHaveBeenCalledWith({ data: expect.objectContaining({ trabajadorId: "t1", seccionId: "seccion-hoy", terminalOrigenId: "terminal-1" }) });
  });

  it("devuelve el registro existente ante un duplicado exacto", async () => {
    const duplicado = { id: "existente" };
    mocks.crear.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "test" }));
    mocks.buscar.mockResolvedValue(duplicado);
    await expect(registrarAsistencia("t1", "terminal-1", base)).resolves.toBe(duplicado);
    expect(mocks.buscar).toHaveBeenCalledWith({ where: expect.objectContaining({ trabajadorId: "t1", terminalOrigenId: "terminal-1" }) });
  });

  it("permite otra hora del mismo día", async () => {
    await registrarAsistencia("t1", "terminal-1", base);
    await registrarAsistencia("t1", "terminal-1", { ...base, hora: "17:00" });
    const horas = mocks.crear.mock.calls.map((c) => c[0].data.hora.toISOString());
    expect(horas).toEqual(["1970-01-01T08:00:00.000Z", "1970-01-01T17:00:00.000Z"]);
  });

  it("no restringe la marcación por el Frente asignado al trabajador", async () => {
    await expect(registrarAsistencia("trabajador-frente-a", "terminal-frente-b", base)).resolves.toBeDefined();
    expect(mocks.crear).toHaveBeenCalledWith({ data: expect.objectContaining({ trabajadorId: "trabajador-frente-a", terminalOrigenId: "terminal-frente-b" }) });
  });

  it("rechaza una terminal asignada a otra Obra sin mezclar scopes", async () => {
    mocks.terminal.mockResolvedValue({ activo: true, obraId: "obra-distinta" });
    await expect(registrarAsistencia("t1", "terminal-otra-obra", base)).rejects.toMatchObject({ status: 403 });
    expect(mocks.crear).not.toHaveBeenCalled();
  });

  it("rechaza terminal sin Obra cuando no existen Obras", async () => {
    mocks.terminal.mockResolvedValue({ activo: true, obraId: null });
    mocks.obraCount.mockResolvedValue(0);
    await expect(registrarAsistencia("t1", "terminal-sin-obra", base)).rejects.toMatchObject({ status: 403 });
    expect(mocks.crear).not.toHaveBeenCalled();
  });

  it("permite terminal sin Obra en el modo transitorio de una sola Obra", async () => {
    mocks.terminal.mockResolvedValue({ activo: true, obraId: null });
    mocks.obraCount.mockResolvedValue(1);
    await expect(registrarAsistencia("t1", "terminal-sin-obra", base)).resolves.toBeDefined();
  });

  it("rechaza terminal sin Obra cuando hay varias Obras", async () => {
    mocks.terminal.mockResolvedValue({ activo: true, obraId: null });
    mocks.obraCount.mockResolvedValue(2);
    await expect(registrarAsistencia("t1", "terminal-ambiguo", base)).rejects.toMatchObject({ status: 403 });
    expect(mocks.crear).not.toHaveBeenCalled();
  });
});

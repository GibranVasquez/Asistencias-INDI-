import { MetodoAsistencia, TrabajadorEstatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ terminal: vi.fn(), trabajador: vi.fn(), seccion: vi.fn(), asistencia: vi.fn(), eventoBuscar: vi.fn(), eventoCrear: vi.fn(), registrar: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: {
  terminal: { findUnique: mocks.terminal }, trabajador: { findUnique: mocks.trabajador }, seccion: { findFirst: mocks.seccion },
  asistenciaDiaria: { findFirst: mocks.asistencia }, eventoNoReconciliado: { findFirst: mocks.eventoBuscar, create: mocks.eventoCrear },
} }));
vi.mock("../src/services/asistencia.service", () => ({ registrarAsistencia: mocks.registrar }));

import { parsearLineaAttlog, procesarLoteAttlog, resolverTerminalPorSN } from "../src/services/adms.service";

const terminal = { id: "term-adms", numeroSerie: "SN-LOCAL", activo: true } as never;

beforeEach(() => {
  mocks.trabajador.mockResolvedValue({ id: "t1", estatus: TrabajadorEstatus.activo });
  mocks.seccion.mockResolvedValue({ id: "oficina" });
  mocks.asistencia.mockResolvedValue(null);
  mocks.eventoBuscar.mockResolvedValue(null);
  mocks.eventoCrear.mockResolvedValue({});
  mocks.registrar.mockResolvedValue({});
});

describe("ADMS", () => {
  it("parsea un ATTLOG válido", () => {
    expect(parsearLineaAttlog("42\t2026-08-08 08:15:30\t0\t15")).toEqual({ pin: "42", fechaHora: new Date("2026-08-08T08:15:30Z"), metodoVerifyCrudo: "15" });
  });

  it("registra el PIN conocido con método y sección de oficina", async () => {
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t15")).resolves.toEqual({ procesados: 1, duplicados: 0, noReconciliados: 0 });
    expect(mocks.registrar).toHaveBeenCalledWith("t1", "term-adms", expect.objectContaining({ seccionId: "oficina", metodoUsado: MetodoAsistencia.rostro }));
  });

  it("guarda un PIN desconocido como EventoNoReconciliado sin inventar trabajador", async () => {
    mocks.trabajador.mockResolvedValue(null);
    await expect(procesarLoteAttlog(terminal, "999\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 0, noReconciliados: 1 });
    expect(mocks.eventoCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ pinDispositivo: "999", terminalId: "term-adms" }) });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("detecta un ATTLOG conocido duplicado", async () => {
    mocks.asistencia.mockResolvedValue({ id: "a1" });
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 1, noReconciliados: 0 });
  });

  it("exige número de serie", async () => {
    await expect(resolverTerminalPorSN(undefined)).rejects.toMatchObject({ status: 400 });
    expect(mocks.terminal).not.toHaveBeenCalled();
  });

  it("rechaza un número de serie no reconocido", async () => {
    mocks.terminal.mockResolvedValue(null);
    await expect(resolverTerminalPorSN("SN-FALSO")).rejects.toMatchObject({ status: 403 });
  });
});

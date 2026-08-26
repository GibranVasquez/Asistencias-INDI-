import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  lock: vi.fn(),
  evento: vi.fn(),
  trabajador: vi.fn(),
  seccion: vi.fn(),
  terminal: vi.fn(),
  createMany: vi.fn(),
  asistencia: vi.fn(),
  updateEvento: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../src/utils/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { reconciliarEventoAdms } from "../src/services/reconciliacion.service";

const ids = {
  evento: "11111111-1111-4111-8111-111111111111",
  trabajador: "22222222-2222-4222-8222-222222222222",
  seccion: "33333333-3333-4333-8333-333333333333",
  terminal: "44444444-4444-4444-8444-444444444444",
  asistencia: "55555555-5555-4555-8555-555555555555",
  actor: "66666666-6666-4666-8666-666666666666",
};

beforeEach(() => {
  vi.clearAllMocks();
  const tx = {
    $queryRaw: mocks.lock,
    eventoNoReconciliado: { findUnique: mocks.evento, update: mocks.updateEvento },
    trabajador: { findUnique: mocks.trabajador },
    seccion: { findUnique: mocks.seccion },
    terminal: { findUnique: mocks.terminal },
    asistenciaDiaria: { createMany: mocks.createMany, findFirstOrThrow: mocks.asistencia },
    auditLog: { create: mocks.audit },
  };
  mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  mocks.lock.mockResolvedValue([{ id: ids.evento }]);
  mocks.evento.mockResolvedValue({
    id: ids.evento,
    pinDispositivo: "001",
    fechaMarcacion: new Date("2026-08-25T00:00:00Z"),
    horaMarcacion: new Date("1970-01-01T23:59:59Z"),
    marcadoEn: new Date("2026-08-26T05:59:59Z"),
    creadoEn: new Date("2026-08-26T06:00:00Z"),
    metodoCrudo: "15",
    terminalId: ids.terminal,
    reconciliadoEn: null,
    reconciliadoPorId: null,
    asistencia: null,
  });
  mocks.trabajador.mockResolvedValue({ id: ids.trabajador, estatus: "activo", numeroChecador: 1 });
  mocks.seccion.mockResolvedValue({ id: ids.seccion });
  mocks.terminal.mockResolvedValue({ id: ids.terminal });
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.asistencia.mockResolvedValue({ id: ids.asistencia, trabajadorId: ids.trabajador, seccionId: ids.seccion });
  mocks.updateEvento.mockResolvedValue({});
  mocks.audit.mockResolvedValue({});
});

describe("reconciliarEventoAdms", () => {
  it("usa campos civiles, acepta PIN numérico normalizado y audita", async () => {
    const resultado = await reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion });
    expect(resultado.resultado).toBe("reconciliado");
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ fecha: new Date("2026-08-25T00:00:00Z"), hora: new Date("1970-01-01T23:59:59Z"), seccionId: ids.seccion, terminalOrigenId: ids.terminal })], skipDuplicates: true }));
    expect(mocks.updateEvento).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ asistenciaId: ids.asistencia, reconciliadoPorId: ids.actor }) }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accion: "reconciliar_evento_adms" }) }));
  });

  it("rechaza un PIN reasignado aunque el trabajador haya sido seleccionado explícitamente", async () => {
    mocks.trabajador.mockResolvedValue({ id: ids.trabajador, estatus: "activo", numeroChecador: 2 });
    await expect(reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion })).rejects.toMatchObject({ status: 422 });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rechaza un evento histórico sin fecha civil", async () => {
    mocks.evento.mockResolvedValueOnce({ ...(await mocks.evento()), fechaMarcacion: null });
    await expect(reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion })).rejects.toMatchObject({ status: 422 });
  });

  it("rechaza un evento histórico sin hora civil y PIN no numérico", async () => {
    mocks.evento.mockResolvedValueOnce({ ...(await mocks.evento()), horaMarcacion: null });
    await expect(reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion })).rejects.toMatchObject({ status: 422 });

    mocks.evento.mockResolvedValueOnce({ ...(await mocks.evento()), pinDispositivo: "PIN-A" });
    await expect(reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion })).rejects.toMatchObject({ status: 422 });
  });

  it("rechaza un trabajador inactivo", async () => {
    mocks.trabajador.mockResolvedValue({ id: ids.trabajador, estatus: "baja", numeroChecador: 1 });
    await expect(reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion })).rejects.toMatchObject({ status: 422 });
  });

  it("devuelve ya reconciliado sin crear ni auditar de nuevo", async () => {
    mocks.evento.mockResolvedValueOnce({ ...(await mocks.evento()), asistencia: { id: ids.asistencia, trabajadorId: ids.trabajador, seccionId: ids.seccion }, reconciliadoEn: new Date("2026-08-26T06:00:00Z"), reconciliadoPorId: ids.actor });
    const resultado = await reconciliarEventoAdms(ids.actor, ids.evento, { trabajadorId: ids.trabajador, seccionId: ids.seccion });
    expect(resultado.resultado).toBe("ya_reconciliado");
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

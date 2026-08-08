import { Prisma, TrabajadorEstatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trabajadorFindUnique: vi.fn(),
  nominaFindUnique: vi.fn(),
  asistenciaFindMany: vi.fn(),
  movimientoFindMany: vi.fn(),
  tarifaFindFirst: vi.fn(),
  nominaCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../src/utils/prisma", () => ({
  prisma: {
    trabajador: { findUnique: mocks.trabajadorFindUnique },
    nominaSemanal: { findUnique: mocks.nominaFindUnique },
    asistenciaDiaria: { findMany: mocks.asistenciaFindMany },
    movimientoTrabajador: { findMany: mocks.movimientoFindMany },
    tarifaHoraExtra: { findFirst: mocks.tarifaFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { generarNominaSemanal } from "../src/services/nomina.service";

const inicio = "2026-08-03";
const fin = "2026-08-09";

function trabajador(sueldo = 700) {
  return {
    id: "trabajador-1",
    nombreCompleto: "Persona de prueba",
    categoria: "Prueba",
    sueldoBase: new Prisma.Decimal(sueldo),
    infonavitMontoPorPeriodo: new Prisma.Decimal(0),
    estatus: TrabajadorEstatus.activo,
  } as never;
}

function datos(descuentosVarios = 0) {
  return { periodoInicio: inicio, periodoFin: fin, horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios };
}

beforeEach(() => {
  mocks.trabajadorFindUnique.mockResolvedValue(trabajador());
  mocks.nominaFindUnique.mockResolvedValue(null);
  mocks.asistenciaFindMany.mockResolvedValue([]);
  mocks.movimientoFindMany.mockResolvedValue([]);
  mocks.tarifaFindFirst.mockResolvedValue(null);
  mocks.auditCreate.mockResolvedValue({});
  mocks.nominaCreate.mockImplementation(async ({ data }) => ({
    id: "nomina-1",
    estatus: "pendiente",
    ...data,
  }));
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ nominaSemanal: { create: mocks.nominaCreate }, auditLog: { create: mocks.auditCreate } })
  );
});

describe("generación de nómina", () => {
  it("calcula sueldoBase / 7 * días laborados", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([
      { fecha: new Date("2026-08-03T00:00:00Z") },
      { fecha: new Date("2026-08-04T00:00:00Z") },
      { fecha: new Date("2026-08-05T00:00:00Z") },
    ]);

    await generarNominaSemanal("rh-1", "trabajador-1", datos());

    const persistido = mocks.nominaCreate.mock.calls[0][0].data;
    expect(persistido.diasLaborados).toBe(3);
    expect(persistido.montoSueldo.toString()).toBe("300");
    expect(persistido.totalAPagar.toString()).toBe("300");
  });

  it("cuenta un día con asistencia", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([{ fecha: new Date("2026-08-04T00:00:00Z") }]);
    await generarNominaSemanal("rh-1", "trabajador-1", datos());
    expect(mocks.nominaCreate.mock.calls[0][0].data.diasLaborados).toBe(1);
  });

  it("cuenta un movimiento marcado como día trabajado", async () => {
    mocks.movimientoFindMany.mockResolvedValue([{ fechaInicio: new Date("2026-08-05T00:00:00Z"), fechaFin: null, tipoMovimiento: { cuentaComoDiaTrabajado: true } }]);
    await generarNominaSemanal("rh-1", "trabajador-1", datos());
    expect(mocks.nominaCreate.mock.calls[0][0].data.diasLaborados).toBe(5);
  });

  it("no duplica un día que tiene asistencia y movimiento", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([{ fecha: new Date("2026-08-05T00:00:00Z") }]);
    mocks.movimientoFindMany.mockResolvedValue([{ fechaInicio: new Date("2026-08-05T00:00:00Z"), fechaFin: new Date("2026-08-05T00:00:00Z"), tipoMovimiento: { cuentaComoDiaTrabajado: true } }]);
    await generarNominaSemanal("rh-1", "trabajador-1", datos());
    expect(mocks.nominaCreate.mock.calls[0][0].data.diasLaborados).toBe(1);
  });

  it("ignora movimientos que no cuentan como día trabajado", async () => {
    mocks.movimientoFindMany.mockResolvedValue([{ fechaInicio: new Date("2026-08-03T00:00:00Z"), fechaFin: null, tipoMovimiento: { cuentaComoDiaTrabajado: false } }]);
    await generarNominaSemanal("rh-1", "trabajador-1", datos());
    expect(mocks.nominaCreate.mock.calls[0][0].data.diasLaborados).toBe(0);
  });

  it("rechaza total negativo antes de persistir", async () => {
    await expect(generarNominaSemanal("rh-1", "trabajador-1", datos(1))).rejects.toMatchObject({ status: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.nominaCreate).not.toHaveBeenCalled();
  });

  it("persiste el sueldo calculado como snapshot y no una referencia al trabajador", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([{ fecha: new Date("2026-08-03T00:00:00Z") }]);
    await generarNominaSemanal("rh-1", "trabajador-1", datos());
    expect(mocks.nominaCreate.mock.calls[0][0].data.montoSueldo.toString()).toBe("100");
    expect(mocks.nominaCreate.mock.calls[0][0].data).not.toHaveProperty("sueldoBase");
  });

  it("no reescribe una nómina histórica cuando ya existe", async () => {
    mocks.nominaFindUnique.mockResolvedValue({ id: "nomina-historica" });
    mocks.trabajadorFindUnique.mockResolvedValue(trabajador(1400));
    await expect(generarNominaSemanal("rh-1", "trabajador-1", datos())).rejects.toMatchObject({ status: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

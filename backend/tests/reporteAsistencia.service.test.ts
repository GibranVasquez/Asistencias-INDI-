import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  asistenciaFindMany: vi.fn(),
  seccionFindMany: vi.fn(),
  horarioFindMany: vi.fn(),
  trabajadorCount: vi.fn(),
  trabajadorFindUnique: vi.fn(),
}));

vi.mock("../src/utils/prisma", () => ({
  prisma: {
    asistenciaDiaria: { findMany: mocks.asistenciaFindMany },
    seccion: { findMany: mocks.seccionFindMany },
    horario: { findMany: mocks.horarioFindMany },
    trabajador: { count: mocks.trabajadorCount, findUnique: mocks.trabajadorFindUnique },
  },
}));

import { obtenerReporteAsistencia } from "../src/services/reporteAsistencia.service";

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}Z`);

beforeEach(() => {
  mocks.seccionFindMany.mockImplementation(async ({ select }: { select?: { id?: boolean; nombre?: boolean; horarioId?: boolean } }) =>
    select?.nombre ? [{ id: "seccion-1", nombre: "Frente A" }] : [{ id: "seccion-1", horarioId: "horario-1" }]
  );
  mocks.horarioFindMany.mockResolvedValue([{ id: "horario-1", horaEntrada: hora("08:00:00"), toleranciaMinutos: 10 }]);
  mocks.trabajadorCount.mockResolvedValue(1);
});

describe("reporte de asistencia", () => {
  it("usa la primera marcación cronológica aunque las marcas lleguen desordenadas", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([
      { fecha: fecha("2026-08-03"), hora: hora("08:15:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1" },
      { fecha: fecha("2026-08-03"), hora: hora("07:58:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1" },
    ]);
    const reporte = await obtenerReporteAsistencia("2026-08-03", "2026-08-03");
    expect(reporte.resumen).toMatchObject({ presentes: 1, aTiempo: 1, tardanzas: 0, porcentajePuntualidad: 100 });
  });

  it("deja sin clasificar una asistencia cuyo Frente no tiene horario", async () => {
    mocks.seccionFindMany.mockImplementation(async ({ select }: { select?: { nombre?: boolean } }) =>
      select?.nombre ? [{ id: "seccion-1", nombre: "Frente sin horario" }] : [{ id: "seccion-1", horarioId: null }]
    );
    mocks.horarioFindMany.mockResolvedValue([]);
    mocks.asistenciaFindMany.mockResolvedValue([{ fecha: fecha("2026-08-03"), hora: hora("08:00:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1" }]);
    const reporte = await obtenerReporteAsistencia("2026-08-03", "2026-08-03");
    expect(reporte.resumen).toMatchObject({ presentes: 1, aTiempo: 0, tardanzas: 0, porcentajePuntualidad: null });
  });
});

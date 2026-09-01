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
import { obtenerHistoricoTrabajador } from "../src/services/reporteAsistencia.service";

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}Z`);

beforeEach(() => {
  mocks.seccionFindMany.mockImplementation(async ({ select }: { select?: { id?: boolean; nombre?: boolean; horarioId?: boolean } }) =>
    select?.nombre ? [{ id: "seccion-1", nombre: "Frente A" }] : [{ id: "seccion-1", horarioId: "horario-1" }]
  );
  mocks.horarioFindMany.mockResolvedValue([{ id: "horario-1", horaEntrada: hora("08:00:00"), toleranciaMinutos: 10 }]);
  mocks.trabajadorCount.mockResolvedValue(1);
  mocks.trabajadorFindUnique.mockResolvedValue({ id: "trabajador-1", nombreCompleto: "Trabajador de prueba" });
});

describe("reporte de asistencia", () => {
  it("usa la primera marcación cronológica aunque las marcas lleguen desordenadas", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([
      { fecha: fecha("2026-08-03"), hora: hora("08:15:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "entrada" },
      { fecha: fecha("2026-08-03"), hora: hora("07:58:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "entrada" },
    ]);
    const reporte = await obtenerReporteAsistencia("2026-08-03", "2026-08-03");
    expect(reporte.resumen).toMatchObject({ presentes: 1, aTiempo: 1, tardanzas: 0, porcentajePuntualidad: 100 });
  });

  it("deja sin clasificar una asistencia cuyo Frente no tiene horario", async () => {
    mocks.seccionFindMany.mockImplementation(async ({ select }: { select?: { nombre?: boolean } }) =>
      select?.nombre ? [{ id: "seccion-1", nombre: "Frente sin horario" }] : [{ id: "seccion-1", horarioId: null }]
    );
    mocks.horarioFindMany.mockResolvedValue([]);
    mocks.asistenciaFindMany.mockResolvedValue([{ fecha: fecha("2026-08-03"), hora: hora("08:00:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "entrada" }]);
    const reporte = await obtenerReporteAsistencia("2026-08-03", "2026-08-03");
    expect(reporte.resumen).toMatchObject({ presentes: 1, aTiempo: 0, tardanzas: 0, porcentajePuntualidad: null });
  });

  it.each([
    ["salida", "salida"],
    ["salida_descanso", "salida_descanso"],
    ["entrada_descanso", "entrada_descanso"],
    ["entrada_tiempo_extra", "entrada_tiempo_extra"],
    ["salida_tiempo_extra", "salida_tiempo_extra"],
    [null, "legacy"],
  ])("marca %s cuenta como presencia sin puntualidad", async (tipoMarcacion) => {
    mocks.asistenciaFindMany.mockResolvedValue([
      { fecha: fecha("2026-08-03"), hora: hora("07:00:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion },
    ]);
    const reporte = await obtenerHistoricoTrabajador("trabajador-1", "2026-08-03", "2026-08-03");
    expect(reporte.dias[0]).toMatchObject({ presente: true, aTiempo: null });
  });

  it("usa la primera entrada para puntualidad sin afectar presencia", async () => {
    mocks.asistenciaFindMany.mockResolvedValue([
      { fecha: fecha("2026-08-03"), hora: hora("07:00:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "salida" },
      { fecha: fecha("2026-08-03"), hora: hora("08:05:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "entrada" },
      { fecha: fecha("2026-08-03"), hora: hora("08:10:00"), seccionId: "seccion-1", trabajadorId: "trabajador-1", tipoMarcacion: "entrada" },
    ]);
    const reporte = await obtenerHistoricoTrabajador("trabajador-1", "2026-08-03", "2026-08-03");
    expect(reporte.dias[0]).toMatchObject({ presente: true, hora: "07:00:00", aTiempo: true });
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { buscarCandidatoReconciliacion, reconciliarIncidencia } from "@/features/incidencias/api";
import { evaluarElegibilidad, normalizarPin } from "@/features/incidencias/elegibilidad";

const base = {
  id: "e1", tipo: "ADMS_NO_RECONCILIADO" as const, estado: "pendiente" as const,
  fechaEvento: "2026-08-25T23:59:59.000Z", fechaMarcacion: "2026-08-25", horaMarcacion: "23:59:59",
  detectadoEn: "2026-08-25T23:59:59.000Z", identificadorDispositivo: "001", terminal: "ADMS", ubicacion: "Oficina",
  obraId: "obra-a", obraNombre: "Obra A", asistenciaId: null, reconciliadoEn: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("elegibilidad de reconciliación ADMS", () => {
  it("acepta pendiente civil con Obra y PIN numérico", () => expect(evaluarElegibilidad(base)).toEqual({ elegible: true }));
  it("deriva no elegibles por estado, Obra, fecha/hora y PIN", () => {
    expect(evaluarElegibilidad({ ...base, estado: "reconciliada", asistenciaId: "a1" }).elegible).toBe(false);
    expect(evaluarElegibilidad({ ...base, obraId: null }).motivo).toBe("SIN_OBRA");
    expect(evaluarElegibilidad({ ...base, fechaMarcacion: null }).motivo).toBe("HISTORICO_AMBIGUO");
    expect(evaluarElegibilidad({ ...base, horaMarcacion: null }).motivo).toBe("HISTORICO_AMBIGUO");
    expect(evaluarElegibilidad({ ...base, identificadorDispositivo: "12ABC" }).motivo).toBe("PIN_NO_NUMERICO");
  });
  it("normaliza 001 y conserva datos civiles sin Date", () => {
    expect(normalizarPin("001")).toBe(1);
    expect(normalizarPin(" 1001 ")).toBe(1001);
    expect(normalizarPin("1.5")).toBeNull();
    expect(`${base.fechaMarcacion} ${base.horaMarcacion}`).toBe("2026-08-25 23:59:59");
  });
});

describe("clientes API de reconciliación", () => {
  it("consulta candidato por PIN y Frentes se resuelven por obra desde el flujo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidato: { id: "t1", nombreCompleto: "Ana", estatus: "activo", numeroChecador: 1 } }) });
    vi.stubGlobal("fetch", fetchMock);
    await buscarCandidatoReconciliacion("token", "001");
    expect(fetchMock.mock.calls[0][0]).toContain("/trabajadores/candidato-reconciliacion?pin=001");
  });
  it("envía únicamente trabajadorId y seccionId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultado: "reconciliado", evento: { id: "e1", asistenciaId: "a1", reconciliadoEn: "2026-08-26T00:00:00.000Z" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await reconciliarIncidencia("token", "e1", "t1", "s1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ trabajadorId: "t1", seccionId: "s1" });
    expect(JSON.stringify(fetchMock.mock.calls[0][1].body)).not.toContain("obraId");
  });
});

import { describe, expect, it } from "vitest";
import { fechaEventoVisible } from "@/features/incidencias/tiempoCivil";

describe("tiempo civil de incidencias ADMS", () => {
  it("prioriza fecha y hora civiles sin depender de la zona del navegador", () => {
    expect(fechaEventoVisible({
      id: "e1", tipo: "ADMS_NO_RECONCILIADO", estado: "pendiente",
      fechaEvento: "2026-08-25T23:59:59.000Z", fechaMarcacion: "2026-08-25", horaMarcacion: "23:59:59",
      detectadoEn: "2026-08-25T23:59:59.000Z", identificadorDispositivo: "PIN-FICTICIO", terminal: "ADMS", ubicacion: "Oficina", asistenciaId: null, reconciliadoEn: null,
    })).toBe("25/08/2026 23:59:59");
  });

  it("mantiene visible el fallback legacy para históricos sin campos civiles", () => {
    expect(fechaEventoVisible({
      id: "e2", tipo: "ADMS_NO_RECONCILIADO", estado: "pendiente",
      fechaEvento: "2026-08-25T23:59:59.000Z", fechaMarcacion: null, horaMarcacion: null,
      detectadoEn: "2026-08-25T23:59:59.000Z", identificadorDispositivo: "PIN-HISTORICO", terminal: "ADMS", ubicacion: "Oficina", asistenciaId: null, reconciliadoEn: null,
    })).toBeTruthy();
  });
});

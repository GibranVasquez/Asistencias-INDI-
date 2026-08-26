import { describe, expect, it } from "vitest";
import {
  fechaCivilEnTimezone,
  fechaLegibleEnTimezone,
  finMesCivil,
  inicioSemanaCivil,
  rangoCivil,
  relojEnTimezone,
  sumarDiasFechaCivil,
} from "@/features/dashboard/calendarioObra";

describe("calendario civil de la obra", () => {
  it("usa la fecha civil de la obra aunque el proceso tenga otra zona", () => {
    const instante = new Date("2026-08-26T04:30:00.000Z");
    expect(fechaCivilEnTimezone(instante, "America/Matamoros")).toBe("2026-08-25");
    expect(fechaCivilEnTimezone(instante, "UTC")).toBe("2026-08-26");
    expect(fechaCivilEnTimezone(instante, "Asia/Tokyo")).toBe("2026-08-26");
  });

  it("mantiene la aritmética civil independiente de la zona del proceso", () => {
    expect(sumarDiasFechaCivil("2026-08-25", 1)).toBe("2026-08-26");
    expect(sumarDiasFechaCivil("2026-12-31", 1)).toBe("2027-01-01");
    expect(inicioSemanaCivil("2026-08-26")).toBe("2026-08-24");
    expect(finMesCivil("2024-02-12")).toBe("2024-02-29");
  });

  it("construye rangos sobre la fecha civil, no sobre la fecha local", () => {
    expect(rangoCivil("dia", "2026-08-25")).toEqual({ inicio: "2026-08-25", fin: "2026-08-25" });
    expect(rangoCivil("semana", "2026-08-26")).toEqual({ inicio: "2026-08-24", fin: "2026-08-26" });
    expect(rangoCivil("mes", "2026-08-26")).toEqual({ inicio: "2026-08-01", fin: "2026-08-26" });
  });

  it("formatea reloj y fecha operativa en la zona configurada", () => {
    const instante = new Date("2026-08-26T04:30:00.000Z");
    expect(relojEnTimezone(instante, "America/Matamoros")).toBe("23:30:00");
    expect(fechaLegibleEnTimezone(instante, "America/Matamoros")).toContain("25");
  });

  it("usa fallback local seguro para timezone nula o inválida", () => {
    const instante = new Date("2026-08-26T04:30:00.000Z");
    expect(fechaCivilEnTimezone(instante, "America/FooBar")).toBeNull();
    expect(relojEnTimezone(instante, null)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

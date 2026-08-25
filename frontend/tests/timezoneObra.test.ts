import { describe, expect, it } from "vitest";
import { etiquetaTimezoneObra, zonasIANAConfigurables } from "@/features/configuracion/timezoneObra";

describe("configuración de timezone de obra", () => {
  it("genera zonas IANA sin offsets Etc/GMT cuando el runtime las soporta", () => {
    const zonas = zonasIANAConfigurables();
    if (zonas.length > 0) {
      expect(zonas).toContain("America/Matamoros");
      expect(zonas.some((zona) => zona.startsWith("Etc/GMT"))).toBe(false);
    }
  });

  it("muestra el estado nullable explícitamente", () => {
    expect(etiquetaTimezoneObra(null)).toBe("No configurada");
    expect(etiquetaTimezoneObra("America/Matamoros")).toBe("America/Matamoros");
  });
});

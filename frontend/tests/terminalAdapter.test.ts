import { describe, expect, it } from "vitest";
import { mapearPunchS922 } from "../src/main/terminalAdapters/punchMapping";

describe("adapter ZKTeco S922", () => {
  it.each([[0, "entrada"], [1, "salida"], [2, "salida_descanso"], [3, "entrada_descanso"], [4, "entrada_tiempo_extra"], [5, "salida_tiempo_extra"]] as const)("mapea punch %s", (punch, esperado) => {
    expect(mapearPunchS922(punch)).toBe(esperado);
  });
  it("conserva desconocidos como tipo nulo", () => {
    expect(mapearPunchS922(7)).toBeNull();
    expect(mapearPunchS922(null)).toBeNull();
  });
});

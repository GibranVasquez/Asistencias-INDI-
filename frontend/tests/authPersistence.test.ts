import { describe, expect, it } from "vitest";
import { esPersistenciaDegradada } from "../src/renderer/src/context/AuthContext";

describe("estado visible de persistencia de sesión humana", () => {
  it("no trata una sesión deliberadamente efímera como un fallo de safeStorage", () => {
    expect(esPersistenciaDegradada(false, false)).toBe(false);
  });

  it("advierte cuando Recordarme fue solicitado pero no pudo persistirse", () => {
    expect(esPersistenciaDegradada(true, false)).toBe(true);
  });

  it("no advierte cuando Recordarme quedó cifrado correctamente", () => {
    expect(esPersistenciaDegradada(true, true)).toBe(false);
  });
});

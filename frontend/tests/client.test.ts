// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { comprobarSalud, escucharMantenimiento } from "../src/renderer/src/core/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("health y mantenimiento", () => {
  it("notifica activación y desactivación conservando health disponible", async () => {
    const estados: boolean[] = [];
    const dejarDeEscuchar = escucharMantenimiento((activo) => estados.push(activo));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok", maintenance: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "ok", maintenance: false }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(comprobarSalud()).resolves.toBe(true);
    await expect(comprobarSalud()).resolves.toBe(true);
    expect(estados.slice(-2)).toEqual([true, false]);
    dejarDeEscuchar();
  });
});

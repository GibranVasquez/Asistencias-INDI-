// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IndicadorEstadoSistema from "@/layouts/admin/IndicadorEstadoSistema";
import { ProveedorMantenimiento } from "@/app/providers/ProveedorMantenimiento";
import { ProveedorEstadoSistema } from "@/app/providers/ProveedorEstadoSistema";
import { apiClient } from "@/core/api/client";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("estado del sistema", () => {
  it("detecta backend disponible sin mostrar infraestructura", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }));
    render(<ProveedorMantenimiento><ProveedorEstadoSistema><IndicadorEstadoSistema /></ProveedorEstadoSistema></ProveedorMantenimiento>);
    await waitFor(() => expect(screen.getByText("Sistema conectado")).toBeTruthy());
    expect(screen.queryByText(/RDS|AWS|PostgreSQL/i)).toBeNull();
  });
  it("pasa a sin conexión y se recupera sin tocar la sesión", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) }).mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProveedorMantenimiento><ProveedorEstadoSistema><IndicadorEstadoSistema /></ProveedorEstadoSistema></ProveedorMantenimiento>);
    const indicador = await screen.findByRole("button", { name: /Sin conexión/ });
    await act(async () => { indicador.click(); });
    await waitFor(() => expect(screen.getByText("Sistema conectado")).toBeTruthy());
  });
  it("refleja el mantenimiento detectado por el manejo global existente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (entrada: string | URL | Request) => {
      const url = String(entrada);
      return url.endsWith("/health")
        ? { ok: true, status: 200, json: async () => ({ status: "ok" }) }
        : { ok: false, status: 503, json: async () => ({ error: "MAINTENANCE_MODE", message: "Mantenimiento" }) };
    }));
    render(<ProveedorMantenimiento><ProveedorEstadoSistema><IndicadorEstadoSistema /></ProveedorEstadoSistema></ProveedorMantenimiento>);
    await waitFor(() => expect(screen.getByText("Sistema conectado")).toBeTruthy());
    await apiClient.post("/operacion-test", {}, "token-ficticio").catch(() => undefined);
    await waitFor(() => expect(screen.getByText("Mantenimiento")).toBeTruthy());
  });
});

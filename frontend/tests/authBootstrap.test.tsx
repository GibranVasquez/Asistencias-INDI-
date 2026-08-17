// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app/App";
import { ProveedorAutenticacion } from "@/features/auth/ContextoAutenticacion";
import { ProveedorMantenimiento } from "@/app/providers/ProveedorMantenimiento";
import { ProveedorTema } from "@/app/providers/ProveedorTema";

describe("bootstrap de autenticación", () => {
  beforeEach(() => {
    const datos = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return datos.size; }, clear: () => datos.clear(),
      getItem: (clave: string) => datos.get(clave) ?? null,
      key: (indice: number) => [...datos.keys()][indice] ?? null,
      removeItem: (clave: string) => { datos.delete(clave); },
      setItem: (clave: string, valor: string) => { datos.set(clave, valor); },
    });
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })));
  });

  it("no renderiza contenido protegido mientras la sesión sigue en checking", () => {
    Object.defineProperty(window, "indiApp", {
      configurable: true,
      value: {
        esKiosco: false,
        apiBaseUrl: "http://127.0.0.1:44100",
        sesionSegura: {
          leer: vi.fn(() => new Promise(() => {})),
          guardar: vi.fn(),
          borrar: vi.fn(),
        },
        sesionTerminalSegura: { leer: vi.fn(async () => null), guardar: vi.fn(), borrar: vi.fn() },
      },
    });

    render(
      <MemoryRouter initialEntries={["/panel/trabajadores"]}>
        <ProveedorAutenticacion><ProveedorMantenimiento><App /></ProveedorMantenimiento></ProveedorAutenticacion>
      </MemoryRouter>
    );

    expect(screen.getByRole("status", { name: "Verificando sesión" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Trabajadores" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).toBeNull();
  });

  it("presenta Recordarme desactivado por defecto al terminar el bootstrap", async () => {
    Object.defineProperty(window, "indiApp", {
      configurable: true,
      value: {
        esKiosco: false,
        apiBaseUrl: "http://127.0.0.1:44100",
        sesionSegura: { leer: vi.fn(async () => null), guardar: vi.fn(), borrar: vi.fn() },
      },
    });

    render(
      <ProveedorTema><MemoryRouter initialEntries={["/"]}>
        <ProveedorAutenticacion><ProveedorMantenimiento><App /></ProveedorMantenimiento></ProveedorAutenticacion>
      </MemoryRouter></ProveedorTema>
    );

    const recordar = await screen.findByRole("checkbox", { name: "Recordarme" });
    expect((recordar as HTMLInputElement).checked).toBe(false);
  });
});

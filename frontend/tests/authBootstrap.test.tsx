// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../src/renderer/src/App";
import { AuthProvider } from "../src/renderer/src/context/AuthContext";
import { MaintenanceProvider } from "../src/renderer/src/context/MaintenanceContext";

describe("bootstrap de autenticación", () => {
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
        <AuthProvider><MaintenanceProvider><App /></MaintenanceProvider></AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("status", { name: "Verificando sesión" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Trabajadores" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).toBeNull();
  });
});

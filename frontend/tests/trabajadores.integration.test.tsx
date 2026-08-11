// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrabajadoresPage from "../src/renderer/src/pages/TrabajadoresPage";
import type { Trabajador } from "../src/renderer/src/api/trabajadores";

const { listarTrabajadores, aplicarSueldoATrabajadores } = vi.hoisted(() => ({
  listarTrabajadores: vi.fn(),
  aplicarSueldoATrabajadores: vi.fn(),
}));

vi.mock("../src/renderer/src/api/trabajadores", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/renderer/src/api/trabajadores")>();
  return { ...original, listarTrabajadores, aplicarSueldoATrabajadores };
});

vi.mock("../src/renderer/src/context/AuthContext", () => ({
  useAuth: () => ({ sesion: { token: "token-prueba", usuario: { id: "rh", username: "rh", rol: "rh" } } }),
}));

function trabajador(id: string, nombreCompleto: string, categoria: string, estatus: "activo" | "baja" = "activo"): Trabajador {
  return {
    id, nombreCompleto, categoria, estatus, jefeInmediato: "Jefe", tipo: "empleado",
    fechaIngreso: "2026-01-01", sueldoBase: "700", banco: "Banco", clabe: "1",
    cuentaBancaria: "1", infonavitPlazoMeses: null, infonavitMontoPorPeriodo: null,
    huellaRegistrada: true, rostroRegistrado: false, numeroChecador: null, creadoEn: "2026-01-01",
  };
}

const datos = [
  trabajador("a", "Ana Activa", "Campo"),
  trabajador("b", "Bruno Activo", "Oficina"),
  trabajador("c", "Carla Baja", "Campo", "baja"),
];

function renderizar() {
  return render(<MemoryRouter><TrabajadoresPage /></MemoryRouter>);
}

beforeEach(() => {
  listarTrabajadores.mockResolvedValue({ trabajadores: datos });
  aplicarSueldoATrabajadores.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("integración del flujo de sueldo masivo", () => {
  it("selecciona solo activos visibles, conserva selección al filtrar y completa el flujo exitoso", async () => {
    const user = userEvent.setup();
    aplicarSueldoATrabajadores.mockResolvedValue({ afectados: 2 });
    renderizar();
    await screen.findByText("Ana Activa");

    await user.click(screen.getByRole("checkbox", { name: "Seleccionar trabajadores activos visibles" }));
    expect(screen.getByText(/2 trabajadores seleccionados/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Seleccionar a Carla Baja" }) as HTMLInputElement).disabled).toBe(true);

    await user.type(screen.getByPlaceholderText("Buscar por nombre o categoría…"), "Ana");
    expect(screen.getByText(/2 trabajadores seleccionados/)).toBeTruthy();
    await user.clear(screen.getByPlaceholderText("Buscar por nombre o categoría…"));
    await user.type(screen.getByRole("spinbutton"), "900.50");
    await user.click(screen.getByRole("button", { name: "Aplicar sueldo" }));
    const modal = screen.getByText("Aplicar sueldo a trabajadores seleccionados").parentElement!;
    expect(within(modal).getByText(/2 trabajadores/)).toBeTruthy();
    const confirmar = within(modal).getByRole("button", { name: "Aplicar a 2" });
    expect(document.activeElement).toBe(confirmar);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(aplicarSueldoATrabajadores).toHaveBeenCalledWith("token-prueba", ["a", "b"], 900.5));
    await screen.findByText("Sueldo aplicado correctamente a 2 trabajadores.");
    expect(screen.getByText(/0 trabajadores seleccionados/)).toBeTruthy();
    expect(screen.queryByText("Aplicar sueldo a trabajadores seleccionados")).toBeNull();
    expect(listarTrabajadores).toHaveBeenCalledTimes(2);
  });

  it("bloquea monto inválido y conserva modal/selección para reintentar tras error", async () => {
    const user = userEvent.setup();
    aplicarSueldoATrabajadores.mockRejectedValue(new Error("fallo controlado"));
    renderizar();
    await screen.findByText("Ana Activa");
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar a Ana Activa" }));
    const aplicar = screen.getByRole("button", { name: "Aplicar sueldo" });
    expect((aplicar as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole("spinbutton"), "-1");
    expect((aplicar as HTMLButtonElement).disabled).toBe(true);
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "0.25");
    await user.click(aplicar);
    await user.click(screen.getByRole("button", { name: "Aplicar a 1" }));

    await screen.findByText("No se pudo conectar con el servidor.");
    expect(screen.getByText("Aplicar sueldo a trabajadores seleccionados")).toBeTruthy();
    expect(screen.getByText(/1 trabajador seleccionado/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Aplicar a 1" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

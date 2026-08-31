// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import EncargadoPage from "@/features/encargado/EncargadoPage";

const estado = vi.hoisted(() => ({ rol: "rh" as "rh" | "administrador" | "encargado_seccion" }));

vi.mock("@/features/auth/ContextoAutenticacion", () => ({
  useAutenticacion: () => ({
    sesion: {
      token: "token-de-prueba",
      usuario: {
        rol: estado.rol,
        seccionesAsignadas: estado.rol === "encargado_seccion" ? [{ id: "frente-a", nombre: "Frente A" }] : [],
      },
    },
  }),
}));

vi.mock("@/features/encargado/ResponsablesPorFrentePage", () => ({
  default: () => <div data-testid="responsables-page">Responsables por frente</div>,
}));

vi.mock("@/core/api/resources/secciones", () => ({
  listarSecciones: vi.fn().mockResolvedValue({
    secciones: [
      { id: "frente-a", obraId: "obra-1", nombre: "Frente A", horarioId: null, tramoUbicacion: null, creadoEn: "2026-01-01" },
      { id: "frente-b", obraId: "obra-1", nombre: "Frente B", horarioId: null, tramoUbicacion: null, creadoEn: "2026-01-01" },
    ],
  }),
}));

vi.mock("@/features/encargado/asignacionesApi", () => ({
  obtenerResumenHoy: vi.fn().mockResolvedValue({ fecha: "2026-08-31", seccionId: "frente-a", presentes: [], sinAsignacion: true, totalAsignado: null, ausentes: null }),
  listarAsistencias: vi.fn().mockResolvedValue({ asistencias: [] }),
  obtenerSugerencia: vi.fn(),
  asignarSeccionDelDia: vi.fn(),
}));

vi.mock("@/features/asistencias/api", () => ({ listarAsistencias: vi.fn().mockResolvedValue({ asistencias: [] }) }));
vi.mock("@/features/trabajadores/api", () => ({ listarTrabajadoresBasico: vi.fn().mockResolvedValue({ trabajadores: [] }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EncargadoPage por rol", () => {
  it("permite a RH alternar entre responsables y asignación diaria", async () => {
    estado.rol = "rh";
    const user = userEvent.setup();
    render(<EncargadoPage />);

    expect(screen.getByRole("tab", { name: "Responsables por frente" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("responsables-page")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Asignación diaria" }));
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("tab-asignacion-diaria");
    expect(await screen.findByText("Sin asignación cargada hoy")).toBeTruthy();
    expect(screen.queryByTestId("responsables-page")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".modal-backdrop")).toBeNull();
  });

  it("mantiene al administrador únicamente en responsables por frente", () => {
    estado.rol = "administrador";
    render(<EncargadoPage />);
    expect(screen.getByTestId("responsables-page")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Asignación diaria" })).toBeNull();
  });

  it("mantiene al encargado en Mi frente sin la administración de responsables", async () => {
    estado.rol = "encargado_seccion";
    render(<EncargadoPage />);
    expect(await screen.findByText("Sin asignación cargada hoy")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByTestId("responsables-page")).toBeNull();
  });
});

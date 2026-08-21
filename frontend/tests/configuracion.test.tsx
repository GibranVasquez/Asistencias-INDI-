// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfiguracionPage from "@/features/configuracion/ConfiguracionPage";
import { listarHorarios } from "@/core/api/resources/horarios";
import {
  asignarResponsableTramo,
  editarSeccion,
  listarSecciones,
  retirarResponsableTramo,
} from "@/core/api/resources/secciones";

const estado = vi.hoisted(() => ({ rol: "rh" }));

vi.mock("@/features/auth/ContextoAutenticacion", () => ({
  useAutenticacion: () => ({
    sesion: { token: "token-ficticio", usuario: { rol: estado.rol } },
  }),
}));

vi.mock("@/core/api/resources/obras", () => ({
  obtenerObraActual: vi.fn().mockResolvedValue({ obra: { id: "obra-1", nombre: "Obra ficticia" } }),
  editarObraActual: vi.fn(),
}));

vi.mock("@/core/api/resources/horarios", () => ({
  listarHorarios: vi.fn().mockResolvedValue({ horarios: [] }),
  crearHorario: vi.fn(),
  editarHorario: vi.fn(),
  borrarHorario: vi.fn(),
}));

vi.mock("@/core/api/resources/encargados", () => ({
  listarEncargados: vi.fn().mockResolvedValue({
    usuarios: [{ id: "usuario-tecnico-1", username: "tecnico-ficticio", trabajadorNombre: null, trabajadorCategoria: null }],
  }),
}));

vi.mock("@/core/api/resources/secciones", () => ({
  listarSecciones: vi.fn().mockResolvedValue({ secciones: [] }),
  crearSeccion: vi.fn(),
  editarSeccion: vi.fn(),
  borrarSeccion: vi.fn(),
  listarTrabajadoresResponsables: vi.fn().mockResolvedValue({
    trabajadores: [
      { id: "responsable-actual", nombreCompleto: "Responsable actual", categoria: "Operación", estatus: "activo" },
      { id: "trabajador-1", nombreCompleto: "Responsable ficticio", categoria: "Operación", estatus: "activo" },
    ],
  }),
  asignarResponsableTramo: vi.fn(),
  retirarResponsableTramo: vi.fn(),
}));

vi.mock("@/core/api/resources/tiposMovimiento", () => ({
  listarTiposMovimiento: vi.fn().mockResolvedValue({ tiposMovimiento: [] }),
  crearTipoMovimiento: vi.fn(),
  editarTipoMovimiento: vi.fn(),
  borrarTipoMovimiento: vi.fn(),
}));

vi.mock("@/core/api/resources/tarifasHoraExtra", () => ({
  listarTarifasHoraExtra: vi.fn().mockResolvedValue({ tarifas: [] }),
  crearTarifaHoraExtra: vi.fn(),
}));

vi.mock("@/core/api/resources/categoriasTrabajador", () => ({
  listarCategoriasTrabajador: vi.fn().mockResolvedValue({
    categorias: [{ id: "categoria-1", nombre: "Categoría ficticia", sueldoBaseDefault: 700, esDefault: false }],
  }),
  crearCategoriaTrabajador: vi.fn(),
  editarCategoriaTrabajador: vi.fn(),
  borrarCategoriaTrabajador: vi.fn(),
  aplicarSueldoATodosDeCategoria: vi.fn(),
}));

vi.mock("@/features/trabajadores/api", () => ({
  listarTrabajadores: vi.fn().mockResolvedValue({ trabajadores: [] }),
}));

beforeEach(() => {
  estado.rol = "rh";
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Configuración", () => {
  it("mantiene las tabs RH y el modal de horarios fuera de la tarjeta", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPage />);

    for (const tab of ["Datos de la obra", "Horarios", "Frentes", "Tipos de movimiento", "Tarifa hora extra", "Categorías"]) {
      expect(screen.getByRole("button", { name: tab })).not.toBeNull();
    }
    expect(await screen.findByText("0 horarios")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "+ Nuevo horario" }));
    const dialogo = screen.getByRole("dialog");
    expect(screen.getByRole("heading", { name: "Nuevo horario" })).not.toBeNull();
    expect(dialogo.closest(".tarjeta-admin")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    await user.click(screen.getByRole("button", { name: "+ Nuevo horario" }));
    await user.click(document.querySelector(".configuracion-modal-backdrop") as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("distingue cuentas técnicas y responsables operativos en Frentes", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPage />);

    await user.click(screen.getByRole("button", { name: "Frentes" }));
    expect(await screen.findByText("0 frentes")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "+ Nuevo frente" }));

    expect(screen.getByRole("heading", { name: "Nuevo frente" })).not.toBeNull();
    expect(screen.getByLabelText("Cuentas técnicas con acceso")).not.toBeNull();
    expect(screen.getByLabelText("Responsables operativos del tramo")).not.toBeNull();
    expect(screen.getByText("tecnico-ficticio")).not.toBeNull();
    expect(screen.getByText(/Responsable ficticio/)).not.toBeNull();
    expect(screen.getByPlaceholderText("Buscar trabajador activo…")).not.toBeNull();
  });

  it("edita el Frente y sincroniza responsables operativos sin mezclar cuentas técnicas", async () => {
    const user = userEvent.setup();
    const frente = {
      id: "frente-1",
      obraId: "obra-1",
      nombre: "Frente inicial",
      horarioId: "horario-1",
      tramoUbicacion: "Tramo 19",
      creadoEn: "2026-08-21T00:00:00.000Z",
      encargados: [{ id: "usuario-tecnico-1", username: "tecnico-ficticio", trabajadorId: null }],
      responsablesTramo: [{ id: "responsable-actual", nombreCompleto: "Responsable actual", categoria: "Operación", estatus: "activo" as const }],
    };
    vi.mocked(listarSecciones).mockResolvedValueOnce({ secciones: [frente] });
    vi.mocked(listarHorarios).mockResolvedValue({
      horarios: [{
        id: "horario-1",
        nombre: "Turno ficticio",
        horaEntrada: "1970-01-01T08:00:00.000Z",
        horaSalida: "1970-01-01T17:00:00.000Z",
        toleranciaMinutos: 10,
        recesoInicio: null,
        recesoFin: null,
        creadoEn: "2026-08-21T00:00:00.000Z",
      }],
    });
    vi.mocked(editarSeccion).mockResolvedValueOnce({ seccion: frente });
    render(<ConfiguracionPage />);

    await user.click(screen.getByRole("button", { name: "Frentes" }));
    expect(await screen.findByText("Frente inicial")).not.toBeNull();
    await user.click(screen.getByText("Editar").closest("button")!);

    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Frente inicial");
    expect((screen.getByLabelText("Tramo o ubicación de la obra") as HTMLInputElement).value).toBe("Tramo 19");
    expect((screen.getByLabelText("Horario asignado") as HTMLSelectElement).value).toBe("horario-1");
    expect((screen.getByText("tecnico-ficticio").closest("label")!.querySelector("input") as HTMLInputElement).checked).toBe(true);

    const listaResponsables = screen.getByLabelText("Responsables operativos del tramo");
    await user.click(within(listaResponsables).getByText(/Responsable actual/).closest("label")!.querySelector("input")!);
    await user.click(within(listaResponsables).getByText(/Responsable ficticio/).closest("label")!.querySelector("input")!);
    await user.click(screen.getByText("Guardar cambios").closest("button")!);

    await waitFor(() => {
      expect(editarSeccion).toHaveBeenCalledWith("token-ficticio", "frente-1", {
        nombre: "Frente inicial",
        horarioId: "horario-1",
        encargadoIds: ["usuario-tecnico-1"],
        tramoUbicacion: "Tramo 19",
      });
      expect(asignarResponsableTramo).toHaveBeenCalledWith("token-ficticio", "frente-1", "trabajador-1");
      expect(retirarResponsableTramo).toHaveBeenCalledWith("token-ficticio", "frente-1", "responsable-actual");
    });
  });

  it("conserva el panel y modal de Categorías", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionPage />);

    await user.click(screen.getByRole("button", { name: "Categorías" }));
    expect(await screen.findByText("1 categoría")).not.toBeNull();
    expect(screen.getByText("Categoría ficticia")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Aplicar a todos" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "+ Nueva categoría" }));
    expect(screen.getByRole("heading", { name: "Nueva categoría" })).not.toBeNull();
  });

  it("limita al Administrador a Datos de la obra y permite editar", async () => {
    estado.rol = "administrador";
    render(<ConfiguracionPage />);

    expect((await screen.findByDisplayValue("Obra ficticia") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Datos de la obra" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Horarios" })).toBeNull();
    await waitFor(() => expect((screen.getByRole("button", { name: "Guardar cambios" }) as HTMLButtonElement).disabled).toBe(true));
  });
});

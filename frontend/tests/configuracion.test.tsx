// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfiguracionPage from "@/features/configuracion/ConfiguracionPage";

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
    trabajadores: [{ id: "trabajador-1", nombreCompleto: "Responsable ficticio", categoria: "Operación" }],
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

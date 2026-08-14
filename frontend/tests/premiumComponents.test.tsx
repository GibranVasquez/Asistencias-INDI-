// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "../src/renderer/src/components/EmptyState";
import PageHeader from "../src/renderer/src/components/PageHeader";

describe("componentes de jerarquía visual", () => {
  it("mantiene un encabezado semántico y su acción accesible", () => {
    render(<PageHeader titulo="Trabajadores" descripcion="Administra el personal." accion={<button>Nuevo trabajador</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Trabajadores" })).toBeTruthy();
    expect(screen.getByText("Administra el personal.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nuevo trabajador" })).toBeTruthy();
  });

  it("explica el estado vacío sin depender solamente del icono", () => {
    render(<EmptyState titulo="No hay resultados" descripcion="Prueba modificando los filtros." />);
    expect(screen.getByRole("status").textContent).toContain("No hay resultados");
    expect(screen.getByText("Prueba modificando los filtros.")).toBeTruthy();
  });
});

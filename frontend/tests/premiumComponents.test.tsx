// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EstadoVacio from "@/shared/components/EstadoVacio";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";

describe("componentes de jerarquía visual", () => {
  it("mantiene un encabezado semántico y su acción accesible", () => {
    render(<EncabezadoPagina titulo="Trabajadores" descripcion="Administra el personal." accion={<button>Nuevo trabajador</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Trabajadores" })).toBeTruthy();
    expect(screen.getByText("Administra el personal.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nuevo trabajador" })).toBeTruthy();
  });

  it("explica el estado vacío sin depender solamente del icono", () => {
    render(<EstadoVacio titulo="No hay resultados" descripcion="Prueba modificando los filtros." />);
    expect(screen.getByRole("status").textContent).toContain("No hay resultados");
    expect(screen.getByText("Prueba modificando los filtros.")).toBeTruthy();
  });
});

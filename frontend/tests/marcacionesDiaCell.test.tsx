// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarcacionesDiaCell from "@/features/asistencias/MarcacionesDiaCell";

describe("MarcacionesDiaCell", () => {
  it("presenta un solo día con las seis categorías y guiones sin desplazar", () => {
    render(<table><tbody><tr><MarcacionesDiaCell fecha="LUN 31 AGO" marcas={{ entrada: ["08:00"], salida_descanso: [], entrada_descanso: ["15:00"], salida: ["18:00"], entrada_tiempo_extra: [], salida_tiempo_extra: [] }} sinClasificar={0} /></tr></tbody></table>);
    expect(screen.getByLabelText("Marcaciones del LUN 31 AGO")).toBeTruthy();
    expect(screen.getByText("08:00")).toBeTruthy();
    expect(screen.getByText("15:00")).toBeTruthy();
    expect(screen.getByText("18:00")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByLabelText("Salida de descanso")).toBeTruthy();
    expect(screen.getByLabelText("Entrada T.E.")).toBeTruthy();
  });

  it("conserva múltiples horas del mismo tipo y muestra sin clasificar aparte", () => {
    render(<table><tbody><tr><MarcacionesDiaCell fecha="MAR 01 SEP" marcas={{ entrada: ["08:00", "08:03"], salida_descanso: [], entrada_descanso: [], salida: ["18:00", "18:02"], entrada_tiempo_extra: [], salida_tiempo_extra: [] }} sinClasificar={2} /></tr></tbody></table>);
    expect(screen.getByText("08:00 · 08:03")).toBeTruthy();
    expect(screen.getByText("18:00 · 18:02")).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 sin clasificar" })).toBeTruthy();
  });
});

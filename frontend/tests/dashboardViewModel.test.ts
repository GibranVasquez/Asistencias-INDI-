import { describe, expect, it } from "vitest";
import { bucketsPorDia, calcularPuntualidad, inicioDeSemana, rangoConsulta } from "@/features/dashboard/panelPrincipalViewModel";

describe("modelo puro del panel principal", () => {
  it("conserva lunes como inicio de semana y limita el rango al día actual", () => {
    const hoy = new Date(2026, 7, 19);
    const rango = rangoConsulta("semana", hoy);
    expect(rango.inicio).toEqual(new Date(2026, 7, 17));
    expect(rango.fin).toBe(hoy);
    expect(inicioDeSemana(new Date(2026, 7, 23))).toEqual(new Date(2026, 7, 17));
  });

  it("construye buckets diarios incluyendo días sin marcaciones", () => {
    const inicio = new Date(2026, 7, 17);
    const barras = bucketsPorDia(
      [{ fecha: "2026-08-17T00:00:00.000Z" }, { fecha: "2026-08-17T00:00:00.000Z" }],
      inicio,
      new Date(2026, 7, 19)
    );
    expect(barras.map((barra) => barra.valor)).toEqual([2, 0, 0]);
  });

  it("clasifica puntualidad por horario de sección e ignora secciones sin horario", () => {
    const resultado = calcularPuntualidad(
      [
        { seccionId: "s1", hora: "2026-08-19T08:05:00.000Z" },
        { seccionId: "s1", hora: "2026-08-19T08:20:00.000Z" },
        { seccionId: "s2", hora: "2026-08-19T08:00:00.000Z" },
      ],
      [{ id: "s1", horarioId: "h1" }, { id: "s2", horarioId: null }],
      [{ id: "h1", horaEntrada: "2026-08-19T08:00:00.000Z", toleranciaMinutos: 10 }]
    );
    expect(resultado).toEqual({ aTiempo: 1, tarde: 1 });
  });
});

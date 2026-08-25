import { describe, expect, it } from "vitest";
import { aFechaISO, bucketsPorDia, calcularPuntualidad, inicioDeSemana, rangoConsulta } from "@/features/dashboard/panelPrincipalViewModel";

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

  it("mantiene la frontera inclusiva de tolerancia", () => {
    const horario = { id: "h1", horaEntrada: "2026-08-19T08:00:00.000Z", toleranciaMinutos: 10 };
    const resultado = calcularPuntualidad(
      [
        { seccionId: "s1", hora: "2026-08-19T07:59:00.000Z" },
        { seccionId: "s1", hora: "2026-08-19T08:10:00.000Z" },
        { seccionId: "s1", hora: "2026-08-19T08:11:00.000Z" },
      ],
      [{ id: "s1", horarioId: "h1" }],
      [horario]
    );
    expect(resultado).toEqual({ aTiempo: 2, tarde: 1 });
  });

  it("cuenta todas las marcaciones recibidas, sin seleccionar una primera por día", () => {
    const resultado = calcularPuntualidad(
      [
        { seccionId: "s1", hora: "2026-08-19T08:00:00.000Z" },
        { seccionId: "s1", hora: "2026-08-19T08:20:00.000Z" },
      ],
      [{ id: "s1", horarioId: "h1" }],
      [{ id: "h1", horaEntrada: "2026-08-19T08:00:00.000Z", toleranciaMinutos: 10 }]
    );
    expect(resultado).toEqual({ aTiempo: 1, tarde: 1 });
  });

  it("usa fecha local para los rangos y el prefijo textual ISO para las marcaciones", () => {
    const instante = new Date(2026, 7, 20, 23, 30);
    const fechaLocal = aFechaISO(instante);
    const fechaISO = instante.toISOString();
    const barras = bucketsPorDia(
      [{ fecha: fechaISO }],
      new Date(2026, 7, 20),
      new Date(2026, 7, 20)
    );

    expect(fechaLocal).toBe("2026-08-20");
    expect(barras[0].valor).toBe(fechaISO.slice(0, 10) === fechaLocal ? 1 : 0);
  });
});

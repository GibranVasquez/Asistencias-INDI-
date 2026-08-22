import { describe, expect, it } from "vitest";
import {
  bucketsDelRango,
  calcularResumen,
  diasHabilesEnRango,
  granularidadPara,
  unaMarcaPorDia,
} from "../src/services/analiticaAsistencia";

const d = (iso: string) => new Date(iso);

describe("analítica pura de asistencia", () => {
  it("conserva días hábiles UTC de lunes a viernes", () => {
    expect(diasHabilesEnRango(d("2026-08-03T00:00:00Z"), d("2026-08-09T00:00:00Z"))
      .map((fecha) => fecha.toISOString().slice(0, 10)))
      .toEqual(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]);
  });

  it("selecciona la marcación más temprana sin depender del orden de entrada", () => {
    const marcas = unaMarcaPorDia([
      { trabajadorId: "t1", seccionId: "s1", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T08:15:00Z") },
      { trabajadorId: "t1", seccionId: "s1", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T07:58:00Z") },
    ]);
    expect(marcas).toHaveLength(1);
    expect(marcas[0].hora.toISOString()).toBe("2026-08-03T07:58:00.000Z");
  });

  it("preserva límite inclusivo, ausencia de horario y porcentaje nulo", () => {
    const horario = { horaEntrada: d("2026-08-03T08:00:00Z"), toleranciaMinutos: 10 };
    const resumen = calcularResumen([
      { trabajadorId: "t1", seccionId: "s1", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T08:10:00Z") },
      { trabajadorId: "t2", seccionId: "s1", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T08:11:00Z") },
      { trabajadorId: "t3", seccionId: "s2", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T08:00:00Z") },
    ], { seccionHorario: new Map([["s1", horario], ["s2", null]]) },
    [d("2026-08-03T00:00:00Z")], 4, false);

    expect(resumen).toEqual({ presentes: 3, ausentes: 1, tardanzas: 1, aTiempo: 1, porcentajePuntualidad: 50, diasHabiles: 1 });
    expect(calcularResumen([
      { trabajadorId: "t4", seccionId: "sin-horario", fecha: d("2026-08-03T00:00:00Z"), hora: d("2026-08-03T08:00:00Z") },
    ], { seccionHorario: new Map([["sin-horario", null]]) }, [d("2026-08-03T00:00:00Z")], 1, false).porcentajePuntualidad)
      .toBeNull();
  });

  it("conserva granularidad y buckets inclusivos por día, semana y mes", () => {
    const inicio = d("2026-08-03T00:00:00Z");
    expect(granularidadPara(inicio, d("2026-09-16T00:00:00Z"))).toBe("dia");
    expect(granularidadPara(inicio, d("2026-09-17T00:00:00Z"))).toBe("semana");
    expect(granularidadPara(inicio, d("2027-02-01T00:00:00Z"))).toBe("mes");
    expect(bucketsDelRango(inicio, d("2026-08-05T00:00:00Z"), "dia")).toHaveLength(3);
    expect(bucketsDelRango(inicio, d("2026-08-20T00:00:00Z"), "semana")).toHaveLength(3);
    expect(bucketsDelRango(d("2026-08-20T00:00:00Z"), d("2026-10-05T00:00:00Z"), "mes")).toHaveLength(3);
  });
});

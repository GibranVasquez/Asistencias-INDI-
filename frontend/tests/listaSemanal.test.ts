import { describe, expect, it } from "vitest";
import { AsistenciaListada } from "@/features/asistencias/api";
import { agruparAsistenciasPorTrabajador, aISO, lunesDeSemana, numeroSemana, periodoSemanalLegible, sumarDias, rangoExportacion } from "@/features/asistencias/listaSemanal";

function asistencia(parcial: Partial<AsistenciaListada>): AsistenciaListada {
  return {
    id: parcial.id ?? crypto.randomUUID(),
    trabajadorId: parcial.trabajadorId ?? "trabajador-1",
    fecha: parcial.fecha ?? "2026-08-10T00:00:00.000Z",
    hora: parcial.hora ?? "1970-01-01T07:00:00.000Z",
    seccionId: parcial.seccionId ?? "frente-1",
    turno: parcial.turno ?? "diurno",
    metodoUsado: parcial.metodoUsado ?? "huella",
    tipoMarcacion: parcial.tipoMarcacion ?? null,
    punchCrudo: parcial.punchCrudo ?? null,
    terminalOrigenId: parcial.terminalOrigenId ?? "terminal-1",
    trabajadorNombre: parcial.trabajadorNombre ?? "Ana Pérez",
    seccionNombre: parcial.seccionNombre ?? "Frente Norte",
    trabajadorCategoria: parcial.trabajadorCategoria ?? "Operador",
    trabajadorHuellaRegistrada: parcial.trabajadorHuellaRegistrada ?? true,
    seccionTramoUbicacion: parcial.seccionTramoUbicacion ?? null,
    seccionResponsables: parcial.seccionResponsables ?? [],
    obraNombre: parcial.obraNombre ?? "Tren del Golfo de México — Segmentos 19 y 20",
    horarioNombre: parcial.horarioNombre ?? null,
  };
}

describe("lista semanal de asistencia", () => {
  it("construye rangos de exportación diario y semanal sin desplazar fechas", () => {
    expect(rangoExportacion("dia", "2026-09-02", "2026-08-31", "2026-09-06")).toEqual({ fechaInicio: "2026-09-02", fechaFin: "2026-09-02" });
    expect(rangoExportacion("semana", "2026-09-02", "2026-08-31", "2026-09-06")).toEqual({ fechaInicio: "2026-08-31", fechaFin: "2026-09-06" });
  });
  it("calcula lunes y rango de siete días sin mover la fecha por UTC", () => {
    const lunes = lunesDeSemana(new Date(2026, 7, 12));
    expect(aISO(lunes)).toBe("2026-08-10");
    expect(aISO(sumarDias(lunes, 6))).toBe("2026-08-16");
    expect(numeroSemana(lunes)).toBe(33);
  });

  it("presenta el periodo semanal sin repetir el mes cuando corresponde", () => {
    expect(periodoSemanalLegible("2026-08-17", "2026-08-23")).toBe("17 al 23 de agosto de 2026");
    expect(periodoSemanalLegible("2026-08-31", "2026-09-06")).toBe("31 de agosto al 6 de septiembre de 2026");
  });

  it("agrupa por trabajador y día, ordenando sus marcaciones por hora", () => {
    const filas = agruparAsistenciasPorTrabajador([
      asistencia({ id: "2", fecha: "2026-08-11T00:00:00.000Z", hora: "1970-01-01T19:00:00.000Z" }),
      asistencia({ id: "1", fecha: "2026-08-11T00:00:00.000Z", hora: "1970-01-01T07:00:00.000Z" }),
      asistencia({ id: "3", trabajadorId: "trabajador-2", trabajadorNombre: "Bruno Díaz", fecha: "2026-08-12T00:00:00.000Z", seccionNombre: "Frente Sur" }),
    ]);
    expect(filas.map((fila) => fila.trabajadorNombre)).toEqual(["Ana Pérez", "Bruno Díaz"]);
    expect(filas[0].porDia.get("2026-08-11")?.map((registro) => registro.id)).toEqual(["1", "2"]);
    expect(filas[0].frentes).toEqual(["Frente Norte"]);
  });

  it("conserva todas las horas por tipo sin recorrer categorías", () => {
    const fila = agruparAsistenciasPorTrabajador([
      asistencia({ id: "e1", tipoMarcacion: "entrada", hora: "1970-01-01T08:01:00.000Z" }),
      asistencia({ id: "e2", tipoMarcacion: "entrada", hora: "1970-01-01T08:03:00.000Z" }),
      asistencia({ id: "s1", tipoMarcacion: "salida", hora: "1970-01-01T18:04:00.000Z" }),
      asistencia({ id: "legacy", tipoMarcacion: null, hora: "1970-01-01T12:00:00.000Z" }),
    ])[0];
    expect(fila.marcasPorDia.get("2026-08-10")).toMatchObject({ entrada: ["08:01", "08:03"], salida: ["18:04"], salida_descanso: [] });
    expect(fila.sinClasificarPorDia.get("2026-08-10")).toHaveLength(1);
  });
});

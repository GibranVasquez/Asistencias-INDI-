import { describe, expect, it } from "vitest";
import { AsistenciaListada } from "@/features/asistencias/api";
import { agruparAsistenciasPorTrabajador, aISO, lunesDeSemana, sumarDias } from "@/features/asistencias/listaSemanal";

function asistencia(parcial: Partial<AsistenciaListada>): AsistenciaListada {
  return {
    id: parcial.id ?? crypto.randomUUID(),
    trabajadorId: parcial.trabajadorId ?? "trabajador-1",
    fecha: parcial.fecha ?? "2026-08-10T00:00:00.000Z",
    hora: parcial.hora ?? "1970-01-01T07:00:00.000Z",
    seccionId: parcial.seccionId ?? "frente-1",
    turno: parcial.turno ?? "diurno",
    metodoUsado: parcial.metodoUsado ?? "huella",
    terminalOrigenId: parcial.terminalOrigenId ?? "terminal-1",
    trabajadorNombre: parcial.trabajadorNombre ?? "Ana Pérez",
    seccionNombre: parcial.seccionNombre ?? "Frente Norte",
  };
}

describe("lista semanal de asistencia", () => {
  it("calcula lunes y rango de siete días sin mover la fecha por UTC", () => {
    const lunes = lunesDeSemana(new Date(2026, 7, 12));
    expect(aISO(lunes)).toBe("2026-08-10");
    expect(aISO(sumarDias(lunes, 6))).toBe("2026-08-16");
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
});

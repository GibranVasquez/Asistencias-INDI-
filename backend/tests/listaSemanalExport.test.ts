import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import ExcelJS from "exceljs";
import { generarExcelListaSemanal, generarPdfListaSemanal } from "../src/utils/exportadores/listaSemanalExport";
import { AsistenciaListada } from "../src/services/asistencia.service";

function registro(parcial: Partial<AsistenciaListada> = {}): AsistenciaListada {
  return {
    id: "registro-1", trabajadorId: "trabajador-1", fecha: new Date("2026-08-10T00:00:00Z"), hora: new Date("1970-01-01T07:01:00Z"),
    seccionId: "frente-1", turno: "Diurno", metodoUsado: "huella", terminalOrigenId: "terminal-1",
    trabajadorNombre: "Ana Pérez", trabajadorCategoria: "Operadora", trabajadorHuellaRegistrada: true,
    seccionNombre: "Frente 03", seccionTramoUbicacion: "No especificado", seccionResponsables: [{ id: "t1", nombreCompleto: "Responsable de prueba", categoria: "Operador" }],
    obraNombre: "Tren del Golfo de México — Segmentos 19 y 20", horarioNombre: "Diurno", tipoMarcacion: "entrada", punchCrudo: 0, ...parcial,
  };
}

const contexto = { area: "Tren del Golfo de México — Segmentos 19 y 20", frente: "Frente 03", tramoUbicacion: "Km 1", responsableTramo: "responsable", categoria: "Operadora", turno: "Diurno", semana: "33", fechaInicio: "2026-08-10", fechaFin: "2026-08-16" };

describe("exportación de lista semanal", () => {
  it("incluye el contexto operativo y columnas de días en Excel", async () => {
    const buffer = await generarExcelListaSemanal({ contexto, asistencias: [registro()] });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as Buffer);
    const hoja = libro.getWorksheet("Lista semanal")!;
    expect(hoja.getCell("A2").value).toBe("ÁREA");
    expect(hoja.getCell("B2").value).toContain("Tren del Golfo");
    expect(hoja.getRow(11).values).toContain("LUN 10-AGO Entrada");
    expect(hoja.getRow(11).values).toContain("DOM 16-AGO Salida T.E.");
    expect(hoja.getRow(12).values).toContain("07:01");
  });

  it("genera una lista diaria con una fila por trabajador y cuatro tipos", async () => {
    const buffer = await generarExcelListaSemanal({ contexto: { ...contexto, fechaInicio: "2026-08-10", fechaFin: "2026-08-10" }, asistencias: [registro(), registro({ id: "s", tipoMarcacion: "salida", hora: new Date("1970-01-01T18:02:00Z") }), registro({ id: "sc", tipoMarcacion: null, hora: new Date("1970-01-01T12:00:00Z") }), registro({ id: "rest", tipoMarcacion: "entrada_descanso" })] });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as Buffer);
    const hoja = libro.getWorksheet("Lista diaria")!;
    expect(hoja.getRow(11).values).toEqual(expect.arrayContaining(["Entrada", "Salida", "Entrada T.E.", "Salida T.E.", "SIN CLASIFICAR"]));
    expect(hoja.rowCount).toBe(12);
    expect(hoja.getRow(12).values).toContain("07:01");
    expect(hoja.getRow(12).values).toContain("12:00");
  });

  it("genera un PDF no vacío con el encabezado de la lista", async () => {
    const salida = new PassThrough();
    const partes: Buffer[] = [];
    salida.on("data", (parte) => partes.push(Buffer.from(parte)));
    const terminado = new Promise<void>((resolve) => salida.on("end", resolve));
    generarPdfListaSemanal({ contexto, asistencias: [registro()] }, salida);
    await terminado;
    const pdf = Buffer.concat(partes);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("neutraliza textos que podrían interpretarse como fórmulas en Excel", async () => {
    const buffer = await generarExcelListaSemanal({
      contexto: { ...contexto, frente: "=HYPERLINK(\"https://ejemplo.invalid\")", tramoUbicacion: "+cmd|\"/c calc\"" },
      asistencias: [registro({ trabajadorNombre: "@usuario", trabajadorCategoria: "-10+1" })],
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as Buffer);
    const hoja = libro.getWorksheet("Lista semanal")!;
    expect(hoja.getCell("B3").value).toBe("'=HYPERLINK(\"https://ejemplo.invalid\")");
    expect(hoja.getCell("B4").value).toBe("'+cmd|\"/c calc\"");
    expect(hoja.getCell("B12").value).toBe("'@usuario");
    expect(hoja.getCell("C12").value).toBe("'-10+1");
  });
});

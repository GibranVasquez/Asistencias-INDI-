import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { sanitizarCeldaExcel } from "../src/utils/exportadores/sanitizarCeldaExcel";
import { generarExcelAsistencia } from "../src/utils/exportadores/asistenciaExport";

describe("exportaciones XLSX", () => {
  it.each(["=SUM(1,1)", "+cmd", "-1+2", "@dato"])("neutraliza fórmula potencial %s", (valor) => {
    expect(sanitizarCeldaExcel(valor)).toBe(`'${valor}`);
  });

  it("genera un workbook válido con encabezados, datos y celdas sanitizadas", async () => {
    const buffer = await generarExcelAsistencia({
      desde: "2026-08-01", hasta: "2026-08-08",
      resumen: { presentes: 1, ausentes: 0, tardanzas: 0, aTiempo: 1, porcentajePuntualidad: 100, diasHabiles: 1 },
      porSeccion: [{ seccionId: "s1", seccionNombre: "=SUM(1,1)", presentes: 1, aTiempo: 1, tardanzas: 0, porcentajePuntualidad: 100 }],
      tendencia: [{ etiqueta: "Semana", presentes: 1, ausentes: 0, tardanzas: 0, porcentajePuntualidad: 100 }],
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Por sección", "Tendencia"]);
    expect(libro.getWorksheet("Por sección")?.getRow(1).values).toEqual([undefined, "Sección", "Presentes", "A tiempo", "Tardanzas", "Puntualidad"]);
    expect(libro.getWorksheet("Por sección")?.getCell("A2").value).toBe("'=SUM(1,1)");
  });
});

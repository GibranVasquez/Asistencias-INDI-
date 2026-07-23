import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ReporteNomina } from "../../services/reporteNomina.service";
import { dibujarTabla } from "../pdfTabla";

function moneda(valor: string): string {
  return `$${Number(valor).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

// Ver el comentario en asistenciaExport.ts: pipe(salida) tiene que ir antes
// que end(), nunca después — si no, el primer tramo de bytes se pierde sin
// consumidor y el PDF llega corrupto (aunque válido) al cliente.
export function generarPdfNomina(reporte: ReporteNomina, salida: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(salida);

  doc.font("Helvetica-Bold").fontSize(16).text("Reporte financiero de nómina");
  doc.font("Helvetica").fontSize(10).fillColor("#555").text(`Periodo: ${reporte.desde} al ${reporte.hasta}`);
  doc.moveDown(1);

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(12).text("Resumen");
  doc.font("Helvetica").fontSize(10);
  const r = reporte.resumen;
  doc.text(`Total pagado: ${moneda(r.totalPagado)}    Horas extra: ${moneda(r.totalHorasExtra)}    INFONAVIT: ${moneda(r.totalInfonavit)}    Descuentos: ${moneda(r.totalDescuentos)}    Nóminas: ${r.cantidadNominas}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(12).text("Desglose por categoría");
  doc.moveDown(0.3);
  dibujarTabla(
    doc,
    [
      { etiqueta: "Categoría", ancho: 220 },
      { etiqueta: "Total pagado", ancho: 120 },
      { etiqueta: "Trabajadores", ancho: 100 },
    ],
    reporte.porCategoria.map((c) => [c.categoria, moneda(c.totalPagado), String(c.cantidadTrabajadores)])
  );

  doc.font("Helvetica-Bold").fontSize(12).text("Comparativo por periodo");
  doc.moveDown(0.3);
  dibujarTabla(
    doc,
    [
      { etiqueta: "Periodo", ancho: 130 },
      { etiqueta: "Total pagado", ancho: 100 },
      { etiqueta: "Horas extra", ancho: 90 },
      { etiqueta: "INFONAVIT", ancho: 90 },
      { etiqueta: "Descuentos", ancho: 90 },
    ],
    reporte.porPeriodo.map((p) => [
      `${p.periodoInicio} – ${p.periodoFin}`,
      moneda(p.totalPagado),
      moneda(p.montoHorasExtra),
      moneda(p.infonavitDescuento),
      moneda(p.descuentosVarios),
    ])
  );

  doc.end();
}

export async function generarExcelNomina(reporte: ReporteNomina): Promise<ExcelJS.Buffer> {
  const libro = new ExcelJS.Workbook();

  const hojaResumen = libro.addWorksheet("Resumen");
  hojaResumen.addRow([`Reporte financiero de nómina`]);
  hojaResumen.addRow([`Periodo: ${reporte.desde} al ${reporte.hasta}`]);
  hojaResumen.addRow([]);
  hojaResumen.addRow(["Total pagado", "Horas extra", "INFONAVIT", "Descuentos", "Nóminas"]);
  hojaResumen.addRow([
    Number(reporte.resumen.totalPagado),
    Number(reporte.resumen.totalHorasExtra),
    Number(reporte.resumen.totalInfonavit),
    Number(reporte.resumen.totalDescuentos),
    reporte.resumen.cantidadNominas,
  ]);
  hojaResumen.getRow(4).font = { bold: true };

  const hojaCategoria = libro.addWorksheet("Por categoría");
  hojaCategoria.addRow(["Categoría", "Total pagado", "Trabajadores"]).font = { bold: true };
  for (const c of reporte.porCategoria) {
    hojaCategoria.addRow([c.categoria, Number(c.totalPagado), c.cantidadTrabajadores]);
  }

  const hojaPeriodo = libro.addWorksheet("Por periodo");
  hojaPeriodo.addRow(["Periodo inicio", "Periodo fin", "Total pagado", "Horas extra", "INFONAVIT", "Descuentos", "Nóminas"]).font = { bold: true };
  for (const p of reporte.porPeriodo) {
    hojaPeriodo.addRow([p.periodoInicio, p.periodoFin, Number(p.totalPagado), Number(p.montoHorasExtra), Number(p.infonavitDescuento), Number(p.descuentosVarios), p.cantidadNominas]);
  }

  for (const hoja of libro.worksheets) {
    hoja.columns.forEach((col) => (col.width = 20));
  }

  return libro.xlsx.writeBuffer();
}

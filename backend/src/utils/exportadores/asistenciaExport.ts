import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ReporteAsistencia } from "../../services/reporteAsistencia.service";
import { dibujarTabla } from "../pdfTabla";
import { sanitizarCeldaExcel } from "./sanitizarCeldaExcel";

function pct(valor: number | null): string {
  return valor === null ? "—" : `${valor}%`;
}

// Recibe el destino y hace pipe() ANTES de escribir contenido y de end():
// pdfkit empieza a emitir datos apenas se llama end(), así que generar el
// documento y devolverlo para que el LLAMADOR haga .pipe().end() después
// (como hacía antes) deja pasar el primer tramo de bytes sin consumidor —
// se corrompe el PDF en el cliente (columnas/títulos mal posicionados) sin
// que truene ningún error, porque el stream sigue siendo válido, solo le
// faltan bytes intermedios.
export function generarPdfAsistencia(reporte: ReporteAsistencia, salida: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(salida);

  doc.font("Helvetica-Bold").fontSize(16).text("Reporte de asistencia y puntualidad");
  doc.font("Helvetica").fontSize(10).fillColor("#555").text(`Periodo: ${reporte.desde} al ${reporte.hasta}`);
  doc.moveDown(1);

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(12).text("Resumen");
  doc.font("Helvetica").fontSize(10);
  const r = reporte.resumen;
  doc.text(`Presentes: ${r.presentes}    Ausentes: ${r.ausentes ?? "—"}    Tardanzas: ${r.tardanzas}    A tiempo: ${r.aTiempo}    Puntualidad: ${pct(r.porcentajePuntualidad)}    Días hábiles: ${r.diasHabiles}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(12).text("Desglose por sección");
  doc.moveDown(0.3);
  dibujarTabla(
    doc,
    [
      { etiqueta: "Sección", ancho: 160 },
      { etiqueta: "Presentes", ancho: 80 },
      { etiqueta: "A tiempo", ancho: 80 },
      { etiqueta: "Tardanzas", ancho: 80 },
      { etiqueta: "Puntualidad", ancho: 90 },
    ],
    reporte.porSeccion.map((s) => [s.seccionNombre, String(s.presentes), String(s.aTiempo), String(s.tardanzas), pct(s.porcentajePuntualidad)])
  );

  doc.font("Helvetica-Bold").fontSize(12).text("Tendencia");
  doc.moveDown(0.3);
  dibujarTabla(
    doc,
    [
      { etiqueta: "Periodo", ancho: 160 },
      { etiqueta: "Presentes", ancho: 70 },
      { etiqueta: "Ausentes", ancho: 70 },
      { etiqueta: "Tardanzas", ancho: 70 },
      { etiqueta: "Puntualidad", ancho: 90 },
    ],
    reporte.tendencia.map((t) => [t.etiqueta, String(t.presentes), String(t.ausentes ?? "—"), String(t.tardanzas), pct(t.porcentajePuntualidad)])
  );

  doc.end();
}

export async function generarExcelAsistencia(reporte: ReporteAsistencia): Promise<ExcelJS.Buffer> {
  const libro = new ExcelJS.Workbook();

  const hojaResumen = libro.addWorksheet("Resumen");
  hojaResumen.addRow([`Reporte de asistencia y puntualidad`]);
  hojaResumen.addRow([`Periodo: ${reporte.desde} al ${reporte.hasta}`]);
  hojaResumen.addRow([]);
  hojaResumen.addRow(["Presentes", "Ausentes", "Tardanzas", "A tiempo", "Puntualidad", "Días hábiles"]);
  hojaResumen.addRow([
    reporte.resumen.presentes,
    reporte.resumen.ausentes ?? "—",
    reporte.resumen.tardanzas,
    reporte.resumen.aTiempo,
    pct(reporte.resumen.porcentajePuntualidad),
    reporte.resumen.diasHabiles,
  ]);
  hojaResumen.getRow(4).font = { bold: true };

  const hojaSeccion = libro.addWorksheet("Por sección");
  hojaSeccion.addRow(["Sección", "Presentes", "A tiempo", "Tardanzas", "Puntualidad"]).font = { bold: true };
  for (const s of reporte.porSeccion) {
    hojaSeccion.addRow([
      sanitizarCeldaExcel(s.seccionNombre),
      s.presentes,
      s.aTiempo,
      s.tardanzas,
      pct(s.porcentajePuntualidad),
    ]);
  }

  const hojaTendencia = libro.addWorksheet("Tendencia");
  hojaTendencia.addRow(["Periodo", "Presentes", "Ausentes", "Tardanzas", "Puntualidad"]).font = { bold: true };
  for (const t of reporte.tendencia) {
    hojaTendencia.addRow([t.etiqueta, t.presentes, t.ausentes ?? "—", t.tardanzas, pct(t.porcentajePuntualidad)]);
  }

  for (const hoja of libro.worksheets) {
    hoja.columns.forEach((col) => (col.width = 22));
  }

  return libro.xlsx.writeBuffer();
}

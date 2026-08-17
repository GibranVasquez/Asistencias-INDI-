import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { AsistenciaListada } from "../../services/asistencia.service";
import { sanitizarCeldaExcel } from "./sanitizarCeldaExcel";

export interface ContextoListaExportacion {
  area: string;
  frente: string;
  tramoUbicacion: string;
  responsableTramo: string;
  categoria: string;
  turno: string;
  semana: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface ListaSemanalExportable {
  contexto: ContextoListaExportacion;
  asistencias: AsistenciaListada[];
}

function porTrabajador(asistencias: AsistenciaListada[]): Map<string, AsistenciaListada[]> {
  const grupos = new Map<string, AsistenciaListada[]>();
  for (const asistencia of asistencias) {
    const grupo = grupos.get(asistencia.trabajadorId) ?? [];
    grupo.push(asistencia);
    grupos.set(asistencia.trabajadorId, grupo);
  }
  return grupos;
}

function dias(fechaInicio: string): string[] {
  const resultado: string[] = [];
  const inicio = new Date(`${fechaInicio}T00:00:00Z`);
  for (let indice = 0; indice < 7; indice += 1) {
    const fecha = new Date(inicio);
    fecha.setUTCDate(fecha.getUTCDate() + indice);
    resultado.push(fecha.toISOString().slice(0, 10));
  }
  return resultado;
}

function horas(grupo: AsistenciaListada[], dia: string): [string, string] {
  const delDia = grupo.filter((a) => a.fecha.toISOString().slice(0, 10) === dia).sort((a, b) => a.hora.getTime() - b.hora.getTime());
  return [delDia[0] ? delDia[0].hora.toISOString().slice(11, 16) : "—", delDia.length > 1 ? delDia[delDia.length - 1].hora.toISOString().slice(11, 16) : "—"];
}

export function generarPdfListaSemanal(lista: ListaSemanalExportable, salida: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  doc.pipe(salida);
  doc.font("Helvetica-Bold").fontSize(16).text("LISTA DE ASISTENCIA");
  doc.font("Helvetica").fontSize(9);
  const c = lista.contexto;
  doc.text(`ÁREA: ${c.area}`);
  doc.text(`FRENTE: ${c.frente}    TRAMO O UBICACIÓN DE LA OBRA: ${c.tramoUbicacion}`);
  doc.text(`RESPONSABLE DEL TRAMO: ${c.responsableTramo}    CATEGORÍA: ${c.categoria}    TURNO: ${c.turno}`);
  doc.text(`SEMANA: ${c.semana}    PERIODO: ${c.fechaInicio} AL ${c.fechaFin}`);
  doc.moveDown(0.8);
  const columnas = ["ID", "NOMBRE", "PUESTO", "MARCA", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM", "HUELLA"];
  const anchos = [58, 145, 110, 68, 55, 55, 55, 55, 55, 55, 55, 68];
  const dibujarEncabezado = () => {
    const y = doc.y;
    let x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(8);
    columnas.forEach((columna, i) => { doc.text(columna, x, y, { width: anchos[i], lineBreak: false }); x += anchos[i]; });
    doc.y = y + 16;
  };
  dibujarEncabezado();
  const diasSemana = dias(c.fechaInicio);
  for (const grupo of porTrabajador(lista.asistencias).values()) {
    for (const marca of ["Primera marcación", "Última marcación"]) {
      if (doc.y > doc.page.height - 45) { doc.addPage(); dibujarEncabezado(); }
      const primera = grupo[0];
      const valores = [primera.trabajadorId.slice(0, 8), primera.trabajadorNombre, primera.trabajadorCategoria, marca, ...diasSemana.map((dia) => horas(grupo, dia)[marca.startsWith("Primera") ? 0 : 1]), primera.trabajadorHuellaRegistrada ? "Enrolado" : "No enrolado"];
      const y = doc.y; let x = doc.page.margins.left; doc.font("Helvetica").fontSize(8);
      valores.forEach((valor, i) => { doc.text(valor, x, y, { width: anchos[i], lineBreak: false }); x += anchos[i]; });
      doc.y = y + 14;
    }
  }
  doc.end();
}

export async function generarExcelListaSemanal(lista: ListaSemanalExportable): Promise<ExcelJS.Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Lista semanal");
  const c = lista.contexto;
  hoja.mergeCells("A1:L1"); hoja.getCell("A1").value = "LISTA DE ASISTENCIA"; hoja.getCell("A1").font = { bold: true, size: 16 };
  [["ÁREA", c.area], ["FRENTE", c.frente], ["TRAMO O UBICACIÓN DE LA OBRA", c.tramoUbicacion], ["RESPONSABLE DEL TRAMO", c.responsableTramo], ["CATEGORÍA", c.categoria], ["TURNO", c.turno], ["SEMANA", c.semana], ["PERIODO", `${c.fechaInicio} AL ${c.fechaFin}`]].forEach(([etiqueta, valor], indice) => { hoja.getCell(indice + 2, 1).value = etiqueta; hoja.getCell(indice + 2, 1).font = { bold: true }; hoja.mergeCells(indice + 2, 2, indice + 2, 12); hoja.getCell(indice + 2, 2).value = sanitizarCeldaExcel(String(valor)); });
  const filaEncabezado = 11;
  hoja.getRow(filaEncabezado).values = ["ID", "NOMBRE", "PUESTO", "MARCA", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM", "HUELLA"];
  hoja.getRow(filaEncabezado).font = { bold: true };
  const diasSemana = dias(c.fechaInicio);
  let fila = filaEncabezado + 1;
  for (const grupo of porTrabajador(lista.asistencias).values()) {
    const primera = grupo[0];
    for (const marca of ["Primera marcación", "Última marcación"]) {
      hoja.getRow(fila).values = [primera.trabajadorId.slice(0, 8), sanitizarCeldaExcel(primera.trabajadorNombre), sanitizarCeldaExcel(primera.trabajadorCategoria), marca, ...diasSemana.map((dia) => horas(grupo, dia)[marca.startsWith("Primera") ? 0 : 1]), primera.trabajadorHuellaRegistrada ? "Enrolado" : "No enrolado"];
      fila += 1;
    }
  }
  hoja.columns.forEach((columna, indice) => { columna.width = [14, 28, 24, 20, 12, 12, 12, 12, 12, 12, 12, 16][indice]; });
  hoja.pageSetup.orientation = "landscape"; hoja.pageSetup.fitToPage = true; hoja.pageSetup.fitToWidth = 1;
  return libro.xlsx.writeBuffer();
}

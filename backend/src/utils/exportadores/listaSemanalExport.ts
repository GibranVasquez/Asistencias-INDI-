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

function encabezadoDia(fechaISO: string): string {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  const dia = fecha.toLocaleDateString("es-MX", { weekday: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
  const numero = fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
  return `${dia}\n${numero}`;
}

function periodoLegible(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(`${fechaInicio}T00:00:00Z`);
  const fin = new Date(`${fechaFin}T00:00:00Z`);
  const opcionesInicio: Intl.DateTimeFormatOptions = inicio.getUTCMonth() === fin.getUTCMonth() ? { day: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", timeZone: "UTC" };
  const inicioTexto = inicio.toLocaleDateString("es-MX", opcionesInicio);
  const finTexto = fin.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `${inicioTexto} al ${finTexto}`;
}

export function generarPdfListaSemanal(lista: ListaSemanalExportable, salida: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28 });
  doc.pipe(salida);
  doc.font("Helvetica-Bold").fontSize(16).text("LISTA DE ASISTENCIA");
  doc.font("Helvetica").fontSize(9);
  const c = lista.contexto;
  const campo = (etiqueta: string, valor: string) => {
    doc.font("Helvetica-Bold").text(etiqueta);
    doc.font("Helvetica").text(valor);
  };
  campo("ÁREA / OBRA", c.area);
  campo("FRENTE", c.frente);
  campo("TRAMO O UBICACIÓN DE LA OBRA", c.tramoUbicacion);
  campo("RESPONSABLE DEL TRAMO", c.responsableTramo);
  campo("CATEGORÍA", c.categoria);
  campo("TURNO", c.turno);
  campo("SEMANA", c.semana);
  campo("PERIODO", periodoLegible(c.fechaInicio, c.fechaFin));
  doc.moveDown(0.8);
  const diasSemana = dias(c.fechaInicio);
  const columnas = ["ID", "NOMBRE", "PUESTO / CATEGORÍA", "MARCA", ...diasSemana.map(encabezadoDia), "HUELLA"];
  const anchos = [38, 112, 92, 96, 52, 52, 52, 52, 52, 52, 52, 74];
  const dibujarEncabezado = () => {
    const y = doc.y;
    let x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(8);
    columnas.forEach((columna, i) => { doc.text(columna, x + 3, y, { width: anchos[i] - 6, lineBreak: false }); x += anchos[i]; });
    doc.y = y + 28;
  };
  dibujarEncabezado();
  let numeroTrabajador = 0;
  for (const grupo of porTrabajador(lista.asistencias).values()) {
    numeroTrabajador += 1;
    for (const marca of ["Primera marcación", "Última marcación"]) {
      if (marca === "Primera marcación" && doc.y > doc.page.height - 65) { doc.addPage(); dibujarEncabezado(); }
      const primera = grupo[0];
      const valores = [String(numeroTrabajador).padStart(3, "0"), primera.trabajadorNombre, primera.trabajadorCategoria, marca, ...diasSemana.map((dia) => horas(grupo, dia)[marca.startsWith("Primera") ? 0 : 1]), primera.trabajadorHuellaRegistrada ? "Enrolado" : "No enrolado"];
      const y = doc.y; let x = doc.page.margins.left; doc.font("Helvetica").fontSize(7.5);
      valores.forEach((valor, i) => { doc.text(valor, x + 3, y + 3, { width: anchos[i] - 6, lineBreak: false }); x += anchos[i]; });
      doc.moveTo(doc.page.margins.left, y + 16).lineTo(doc.page.width - doc.page.margins.right, y + 16).strokeColor("#d6dbe3").stroke();
      doc.y = y + 16;
    }
  }
  doc.end();
}

export async function generarExcelListaSemanal(lista: ListaSemanalExportable): Promise<ExcelJS.Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Lista semanal");
  const c = lista.contexto;
  hoja.mergeCells("A1:L1"); hoja.getCell("A1").value = "LISTA DE ASISTENCIA"; hoja.getCell("A1").font = { bold: true, size: 16 };
  [["ÁREA", c.area], ["FRENTE", c.frente], ["TRAMO O UBICACIÓN DE LA OBRA", c.tramoUbicacion], ["RESPONSABLE DEL TRAMO", c.responsableTramo], ["CATEGORÍA", c.categoria], ["TURNO", c.turno], ["SEMANA", c.semana], ["PERIODO", periodoLegible(c.fechaInicio, c.fechaFin)]].forEach(([etiqueta, valor], indice) => { hoja.getCell(indice + 2, 1).value = etiqueta; hoja.getCell(indice + 2, 1).font = { bold: true }; hoja.mergeCells(indice + 2, 2, indice + 2, 12); hoja.getCell(indice + 2, 2).value = sanitizarCeldaExcel(String(valor)); });
  const filaEncabezado = 11;
  const diasSemana = dias(c.fechaInicio);
  hoja.getRow(filaEncabezado).values = ["ID", "NOMBRE", "PUESTO / CATEGORÍA", "MARCA", ...diasSemana.map(encabezadoDia), "HUELLA"];
  hoja.getRow(filaEncabezado).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getRow(filaEncabezado).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173B68" } };
  hoja.getRow(filaEncabezado).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  hoja.getRow(filaEncabezado).height = 30;
  let fila = filaEncabezado + 1;
  let numeroTrabajador = 0;
  for (const grupo of porTrabajador(lista.asistencias).values()) {
    numeroTrabajador += 1;
    const primera = grupo[0];
    const filaInicio = fila;
    for (const marca of ["Primera marcación", "Última marcación"]) {
      hoja.getRow(fila).values = [String(numeroTrabajador).padStart(3, "0"), sanitizarCeldaExcel(primera.trabajadorNombre), sanitizarCeldaExcel(primera.trabajadorCategoria), marca, ...diasSemana.map((dia) => horas(grupo, dia)[marca.startsWith("Primera") ? 0 : 1]), primera.trabajadorHuellaRegistrada ? "Enrolado" : "No enrolado"];
      hoja.getRow(fila).alignment = { vertical: "middle", wrapText: true };
      fila += 1;
    }
    for (const columna of [1, 2, 3, 12]) hoja.mergeCells(filaInicio, columna, fila - 1, columna);
  }
  for (let filaTabla = filaEncabezado; filaTabla < fila; filaTabla += 1) {
    for (let columna = 1; columna <= 12; columna += 1) hoja.getCell(filaTabla, columna).border = { top: { style: "thin", color: { argb: "FFD6DBE3" } }, bottom: { style: "thin", color: { argb: "FFD6DBE3" } }, left: { style: "thin", color: { argb: "FFD6DBE3" } }, right: { style: "thin", color: { argb: "FFD6DBE3" } } };
  }
  hoja.columns.forEach((columna, indice) => { columna.width = [8, 25, 22, 20, 12, 12, 12, 12, 12, 12, 12, 16][indice]; });
  hoja.pageSetup.orientation = "landscape"; hoja.pageSetup.fitToPage = true; hoja.pageSetup.fitToWidth = 1; hoja.pageSetup.fitToHeight = 0; hoja.pageSetup.printTitlesRow = "1:11"; hoja.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  return libro.xlsx.writeBuffer();
}

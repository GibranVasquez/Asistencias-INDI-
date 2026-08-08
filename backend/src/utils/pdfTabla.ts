export interface ColumnaTabla {
  etiqueta: string;
  ancho: number;
}

const ALTO_FILA = 18;
const MARGEN_INFERIOR = 60;

/**
 * Dibuja una tabla simple (sin bordes, columnas de ancho fijo) a partir de
 * la posición actual del cursor del documento — pdfkit no trae tablas de
 * fábrica. Pagina automáticamente si se acerca al margen inferior.
 */
export function dibujarTabla(doc: PDFKit.PDFDocument, columnas: ColumnaTabla[], filas: string[][]): void {
  // doc.page.margins.left (fijo), no doc.x: doc.x queda desplazado a la
  // derecha después de escribir la última celda de una tabla anterior con
  // {x, y} explícitos, y heredar ese valor corría la siguiente tabla entera
  // fuera de la página.
  const xInicial = doc.page.margins.left;

  function encabezado(): void {
    doc.font("Helvetica-Bold").fontSize(9);
    // Capturar y UNA vez antes del loop: doc.text() avanza doc.y solo
    // automáticamente después de escribir, así que reusar doc.y dentro del
    // loop (en vez de esta variable fija) apila las columnas una debajo de
    // otra en lugar de dejarlas en la misma fila.
    const y = doc.y;
    let x = xInicial;
    for (const col of columnas) {
      doc.text(col.etiqueta, x, y, { width: col.ancho, lineBreak: false });
      x += col.ancho;
    }
    doc.y = y + ALTO_FILA;
    doc.font("Helvetica").fontSize(9);
  }

  encabezado();

  for (const fila of filas) {
    if (doc.y > doc.page.height - MARGEN_INFERIOR) {
      doc.addPage();
      encabezado();
    }
    const y = doc.y;
    let x = xInicial;
    fila.forEach((celda, i) => {
      doc.text(celda, x, y, { width: columnas[i].ancho, lineBreak: false });
      x += columnas[i].ancho;
    });
    doc.y = y + ALTO_FILA;
  }

  // Sin esto, doc.x queda en la posición de la última celda escrita (con
  // {x,y} explícitos) y el siguiente texto de flujo normal (un título,
  // párrafo, etc. sin x/y propios) hereda ese desplazamiento en vez de
  // volver al margen izquierdo.
  doc.x = xInicial;
  doc.moveDown(1);
}

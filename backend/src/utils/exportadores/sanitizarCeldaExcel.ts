// Mitigacion de CSV/Excel formula injection (CWE-1236, OWASP "CSV Injection")
// - encontrada en vivo 2026-07-30: categoria/seccionNombre son campos de
// texto libre (Trabajador.categoria, Seccion.nombre, capturados por rh al
// dar de alta) que se escriben tal cual en celdas de los reportes .xlsx
// (nominaExport.ts, asistenciaExport.ts). Un valor que empiece con
// =, +, -, o @ (ej. "=1+1" o el clasico "+cmd|'/c calc'!A1" de inyeccion
// DDE) se guarda como string plano en sharedStrings.xml (sin <f>, no es
// una formula nativa de la hoja) - Excel real respeta ese tipo y no lo
// reinterpreta, pero no todo lector es igual de estricto (LibreOffice
// viejo, herramientas que reimportan el .xlsx, un futuro export a .csv
// real donde no hay tipo de celda que respetar). El fix va en esta capa
// (exportacion), no en la base de datos: el dato real (categoria,
// nombre de seccion) debe seguir intacto para la app misma, solo la
// representacion en el archivo exportado se neutraliza.
const PRIMER_CARACTER_DISPARA_FORMULA = new Set(["=", "+", "-", "@"]);

export function sanitizarCeldaExcel(valor: string): string {
  if (PRIMER_CARACTER_DISPARA_FORMULA.has(valor.charAt(0))) {
    return `'${valor}`;
  }
  return valor;
}

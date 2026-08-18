import { BrowserWindow, dialog, ipcMain, SaveDialogOptions } from "electron";
import { writeFile } from "fs/promises";
import { basename, extname } from "path";

type FormatoExportacion = "pdf" | "xlsx";

interface SolicitudGuardarExportacion {
  nombreSugerido: string;
  formato: FormatoExportacion;
  bytes: Uint8Array;
}

const MAXIMO_BYTES_EXPORTACION = 50 * 1024 * 1024;

function nombreSeguro(nombreSugerido: string, formato: FormatoExportacion): string {
  const extension = `.${formato}`;
  const base = basename(String(nombreSugerido).replace(/[\0\r\n]/g, "_")).replace(/\.\.+/g, ".");
  const sinExtension = extname(base).toLowerCase() === extension ? base.slice(0, -extension.length) : base.replace(/\.[^.]*$/, "");
  const limpio = sinExtension.replace(/[\\/]/g, "_").trim() || "exportacion";
  return `${limpio}${extension}`;
}

function validarSolicitud(valor: unknown): asserts valor is SolicitudGuardarExportacion {
  if (!valor || typeof valor !== "object") throw new Error("Solicitud de exportación inválida.");
  const solicitud = valor as Partial<SolicitudGuardarExportacion>;
  if (solicitud.formato !== "pdf" && solicitud.formato !== "xlsx") throw new Error("Formato de exportación no permitido.");
  if (typeof solicitud.nombreSugerido !== "string" || solicitud.nombreSugerido.length > 180) throw new Error("Nombre de archivo inválido.");
  if (!(solicitud.bytes instanceof Uint8Array) || solicitud.bytes.byteLength === 0 || solicitud.bytes.byteLength > MAXIMO_BYTES_EXPORTACION) {
    throw new Error("Contenido de archivo inválido.");
  }
}

export function registrarHandlerGuardarExportacion(): void {
  ipcMain.handle("archivo:guardar-exportacion", async (evento, valor: unknown) => {
    validarSolicitud(valor);
    const nombre = nombreSeguro(valor.nombreSugerido, valor.formato);
    const ventana = BrowserWindow.fromWebContents(evento.sender);
    const opciones: SaveDialogOptions = {
      title: "Guardar exportación",
      defaultPath: nombre,
      filters: [{ name: valor.formato === "pdf" ? "PDF" : "Excel", extensions: [valor.formato] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    };
    const resultado = ventana ? await dialog.showSaveDialog(ventana, opciones) : await dialog.showSaveDialog(opciones);

    if (resultado.canceled || !resultado.filePath) return { cancelado: true };

    const extension = `.${valor.formato}`;
    const rutaFinal = extname(resultado.filePath).toLowerCase() === extension ? resultado.filePath : `${resultado.filePath}${extension}`;
    try {
      await writeFile(rutaFinal, Buffer.from(valor.bytes));
    } catch {
      throw new Error("No fue posible guardar el archivo.");
    }
    return { cancelado: false, guardado: true };
  });
}

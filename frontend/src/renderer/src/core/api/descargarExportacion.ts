import { ApiError } from "./client";

type FormatoExportacion = "pdf" | "excel";

const TIPOS: Record<FormatoExportacion, { extension: "pdf" | "xlsx"; mime: string }> = {
  pdf: { extension: "pdf", mime: "application/pdf" },
  excel: { extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
};

export async function descargarExportacion(token: string, ruta: string, nombreArchivo: string, formato: FormatoExportacion): Promise<void> {
  const base = window.indiApp?.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.MODE === "production" ? "https://api.sistemasindi.com" : "http://localhost:4000");
  const respuesta = await fetch(`${base}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new ApiError(respuesta.status, datos?.error ?? "No fue posible generar el archivo.");
  }

  const tipo = TIPOS[formato];
  const mime = respuesta.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
  if (mime && mime !== tipo.mime) throw new Error("El servidor devolvió un formato de archivo inesperado.");
  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("El archivo generado está vacío.");

  if (window.indiApp?.guardarExportacion) {
    await window.indiApp.guardarExportacion({ nombreSugerido: nombreArchivo, formato: tipo.extension, bytes });
    return;
  }

  // Fallback para ejecución web fuera de Electron.
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo.mime }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

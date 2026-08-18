import { apiClient } from "@/core/api/client";
import { descargarExportacion } from "@/core/api/descargarExportacion";

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number | null;
  tardanzas: number;
  aTiempo: number;
  porcentajePuntualidad: number | null;
  diasHabiles: number;
}

export interface FilaSeccionAsistencia {
  seccionId: string;
  seccionNombre: string;
  presentes: number;
  aTiempo: number;
  tardanzas: number;
  porcentajePuntualidad: number | null;
}

export interface FilaTendenciaAsistencia extends ResumenAsistencia {
  etiqueta: string;
  periodoInicio: string;
  periodoFin: string;
}

export interface ReporteAsistencia {
  desde: string;
  hasta: string;
  resumen: ResumenAsistencia;
  porSeccion: FilaSeccionAsistencia[];
  tendencia: FilaTendenciaAsistencia[];
}

export interface DiaHistoricoTrabajador {
  fecha: string;
  hora: string | null;
  seccionId: string | null;
  seccionNombre: string | null;
  presente: boolean;
  aTiempo: boolean | null;
}

export interface HistoricoTrabajador {
  trabajadorId: string;
  nombreCompleto: string;
  desde: string;
  hasta: string;
  dias: DiaHistoricoTrabajador[];
  resumen: ResumenAsistencia;
}

export interface ResumenNomina {
  totalPagado: string;
  totalHorasExtra: string;
  totalInfonavit: string;
  totalDescuentos: string;
  cantidadNominas: number;
}

export interface FilaCategoriaNomina {
  categoria: string;
  totalPagado: string;
  cantidadTrabajadores: number;
}

export interface FilaPeriodoNomina {
  periodoInicio: string;
  periodoFin: string;
  totalPagado: string;
  montoHorasExtra: string;
  infonavitDescuento: string;
  descuentosVarios: string;
  cantidadNominas: number;
}

export interface ReporteNomina {
  desde: string;
  hasta: string;
  resumen: ResumenNomina;
  porCategoria: FilaCategoriaNomina[];
  porPeriodo: FilaPeriodoNomina[];
}

export function obtenerReporteAsistencia(token: string, desde: string, hasta: string, seccionId?: string) {
  const qs = new URLSearchParams({ desde, hasta, ...(seccionId ? { seccionId } : {}) });
  return apiClient.get<ReporteAsistencia>(`/reportes/asistencia?${qs}`, token);
}

export function obtenerHistoricoTrabajador(token: string, trabajadorId: string, desde: string, hasta: string) {
  const qs = new URLSearchParams({ desde, hasta });
  return apiClient.get<HistoricoTrabajador>(`/reportes/asistencia/trabajador/${trabajadorId}?${qs}`, token);
}

export function obtenerReporteNomina(token: string, desde: string, hasta: string) {
  const qs = new URLSearchParams({ desde, hasta });
  return apiClient.get<ReporteNomina>(`/reportes/nomina?${qs}`, token);
}

export function exportarAsistencia(
  token: string,
  desde: string,
  hasta: string,
  formato: "pdf" | "excel",
  seccionId?: string
) {
  const qs = new URLSearchParams({ desde, hasta, formato, ...(seccionId ? { seccionId } : {}) });
  const ext = formato === "pdf" ? "pdf" : "xlsx";
  return descargarExportacion(token, `/reportes/asistencia/exportar?${qs}`, `reporte-asistencia_${desde}_${hasta}.${ext}`, formato);
}

export function exportarNomina(token: string, desde: string, hasta: string, formato: "pdf" | "excel") {
  const qs = new URLSearchParams({ desde, hasta, formato });
  const ext = formato === "pdf" ? "pdf" : "xlsx";
  return descargarExportacion(token, `/reportes/nomina/exportar?${qs}`, `reporte-nomina_${desde}_${hasta}.${ext}`, formato);
}

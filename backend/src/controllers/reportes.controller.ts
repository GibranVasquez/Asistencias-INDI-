import { Request, Response } from "express";
import { obtenerHistoricoTrabajador, obtenerReporteAsistencia } from "../services/reporteAsistencia.service";
import { obtenerReporteNomina, registrarExportacionNomina } from "../services/reporteNomina.service";
import { generarExcelAsistencia, generarPdfAsistencia } from "../utils/exportadores/asistenciaExport";
import { generarExcelNomina, generarPdfNomina } from "../utils/exportadores/nominaExport";

export async function asistencia(req: Request, res: Response): Promise<void> {
  const { desde, hasta, seccionId } = req.query;
  const reporte = await obtenerReporteAsistencia(desde as string, hasta as string, seccionId as string | undefined);
  res.json(reporte);
}

export async function exportarAsistencia(req: Request, res: Response): Promise<void> {
  const { desde, hasta, seccionId, formato } = req.query;
  const reporte = await obtenerReporteAsistencia(desde as string, hasta as string, seccionId as string | undefined);
  const nombreArchivo = `reporte-asistencia_${desde}_${hasta}`;

  if (formato === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}.pdf"`);
    generarPdfAsistencia(reporte, res);
    return;
  }

  const buffer = await generarExcelAsistencia(reporte);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}.xlsx"`);
  res.send(Buffer.from(buffer));
}

export async function historicoTrabajador(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.query;
  const historico = await obtenerHistoricoTrabajador(req.params.id as string, desde as string, hasta as string);
  res.json(historico);
}

export async function nomina(req: Request, res: Response): Promise<void> {
  const { desde, hasta } = req.query;
  const reporte = await obtenerReporteNomina(desde as string, hasta as string);
  res.json(reporte);
}

export async function exportarNomina(req: Request, res: Response): Promise<void> {
  const { desde, hasta, formato } = req.query;
  const reporte = await obtenerReporteNomina(desde as string, hasta as string);
  await registrarExportacionNomina(req.user!.usuarioId, desde as string, hasta as string, formato as string);
  const nombreArchivo = `reporte-nomina_${desde}_${hasta}`;

  if (formato === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}.pdf"`);
    generarPdfNomina(reporte, res);
    return;
  }

  const buffer = await generarExcelNomina(reporte);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}.xlsx"`);
  res.send(Buffer.from(buffer));
}

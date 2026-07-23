import { NextFunction, Request, Response } from "express";
import { esFechaISO, esUUID } from "../utils/validacion";

function validarRangoFechas(req: Request, res: Response): boolean {
  const { desde, hasta } = req.query;
  if (!esFechaISO(desde)) {
    res.status(400).json({ error: "desde es requerido en formato YYYY-MM-DD." });
    return false;
  }
  if (!esFechaISO(hasta)) {
    res.status(400).json({ error: "hasta es requerido en formato YYYY-MM-DD." });
    return false;
  }
  return true;
}

function validarFormato(req: Request, res: Response): boolean {
  const { formato } = req.query;
  if (formato !== "pdf" && formato !== "excel") {
    res.status(400).json({ error: "formato es requerido y debe ser 'pdf' o 'excel'." });
    return false;
  }
  return true;
}

export function validarFiltroReporteAsistencia(req: Request, res: Response, next: NextFunction): void {
  if (!validarRangoFechas(req, res)) return;
  const { seccionId } = req.query;
  if (seccionId !== undefined && !esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId debe ser un UUID válido si se envía." });
    return;
  }
  next();
}

export function validarExportarAsistencia(req: Request, res: Response, next: NextFunction): void {
  if (!validarRangoFechas(req, res)) return;
  if (!validarFormato(req, res)) return;
  const { seccionId } = req.query;
  if (seccionId !== undefined && !esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId debe ser un UUID válido si se envía." });
    return;
  }
  next();
}

export function validarHistoricoTrabajador(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del trabajador en la URL debe ser un UUID válido." });
    return;
  }
  if (!validarRangoFechas(req, res)) return;
  next();
}

export function validarFiltroReporteNomina(req: Request, res: Response, next: NextFunction): void {
  if (!validarRangoFechas(req, res)) return;
  next();
}

export function validarExportarNomina(req: Request, res: Response, next: NextFunction): void {
  if (!validarRangoFechas(req, res)) return;
  if (!validarFormato(req, res)) return;
  next();
}

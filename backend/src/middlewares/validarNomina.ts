import { NextFunction, Request, Response } from "express";
import { esFechaISO, esUUID, validarMontosNomina } from "../utils/validacion";

const DIAS_POR_PERIODO = 7;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

export function validarNomina(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { trabajadorId, periodoInicio, periodoFin } = body;

  if (!esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esFechaISO(periodoInicio)) {
    res.status(400).json({ error: "periodoInicio es requerido en formato YYYY-MM-DD." });
    return;
  }

  if (!esFechaISO(periodoFin)) {
    res.status(400).json({ error: "periodoFin es requerido en formato YYYY-MM-DD." });
    return;
  }

  const diffDias = (Date.parse(periodoFin) - Date.parse(periodoInicio)) / UN_DIA_MS;
  if (diffDias !== DIAS_POR_PERIODO - 1) {
    res.status(400).json({ error: `periodoInicio y periodoFin deben abarcar exactamente ${DIAS_POR_PERIODO} días.` });
    return;
  }

  const errorMontos = validarMontosNomina(body);
  if (errorMontos) {
    res.status(400).json({ error: errorMontos });
    return;
  }

  next();
}

export function validarFiltroNomina(req: Request, res: Response, next: NextFunction): void {
  const { trabajadorId } = req.query;
  if (trabajadorId !== undefined && !esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId (query) debe ser un UUID válido si se envía." });
    return;
  }
  next();
}

export function validarIdNomina(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la nómina en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

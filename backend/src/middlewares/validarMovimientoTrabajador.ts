import { NextFunction, Request, Response } from "express";
import { esFechaISO, esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_NOTA = 500;

function validarRangoFechas(fechaInicio: string, fechaFin: unknown): string | null {
  if (fechaFin === undefined || fechaFin === null) {
    return null;
  }
  if (!esFechaISO(fechaFin)) {
    return "fechaFin debe ser una fecha válida en formato YYYY-MM-DD.";
  }
  if (Date.parse(fechaFin) < Date.parse(fechaInicio)) {
    return "fechaFin no puede ser anterior a fechaInicio.";
  }
  return null;
}

export function validarAltaMovimiento(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { trabajadorId, tipoMovimientoId, fechaInicio, fechaFin, nota } = body;

  if (!esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId es requerido y debe ser un UUID válido." });
    return;
  }
  if (!esUUID(tipoMovimientoId)) {
    res.status(400).json({ error: "tipoMovimientoId es requerido y debe ser un UUID válido." });
    return;
  }
  if (!esFechaISO(fechaInicio)) {
    res.status(400).json({ error: "fechaInicio es requerido en formato YYYY-MM-DD." });
    return;
  }

  const errorRango = validarRangoFechas(fechaInicio, fechaFin);
  if (errorRango) {
    res.status(400).json({ error: errorRango });
    return;
  }

  if (nota !== undefined && nota !== null && !esStringNoVacia(nota, LONGITUD_MAXIMA_NOTA)) {
    res.status(400).json({ error: "nota debe ser un texto válido si se envía." });
    return;
  }

  next();
}

export function validarEdicionMovimiento(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del movimiento en la URL debe ser un UUID válido." });
    return;
  }

  const body = req.body ?? {};
  const { fechaInicio, fechaFin, nota } = body;

  if (!esFechaISO(fechaInicio)) {
    res.status(400).json({ error: "fechaInicio es requerido en formato YYYY-MM-DD." });
    return;
  }

  const errorRango = validarRangoFechas(fechaInicio, fechaFin);
  if (errorRango) {
    res.status(400).json({ error: errorRango });
    return;
  }

  if (nota !== undefined && nota !== null && !esStringNoVacia(nota, LONGITUD_MAXIMA_NOTA)) {
    res.status(400).json({ error: "nota debe ser un texto válido si se envía." });
    return;
  }

  next();
}

export function validarIdMovimiento(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del movimiento en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

export function validarFiltroMovimientos(req: Request, res: Response, next: NextFunction): void {
  const { trabajadorId } = req.query;
  if (trabajadorId !== undefined && !esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId (query) debe ser un UUID válido si se envía." });
    return;
  }
  next();
}

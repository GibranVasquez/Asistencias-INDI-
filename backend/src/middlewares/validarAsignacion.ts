import { NextFunction, Request, Response } from "express";
import { esFechaISO, esUUID } from "../utils/validacion";

const MAXIMO_TRABAJADORES_POR_ASIGNACION = 500;

function esArregloDeUUIDs(valor: unknown): valor is string[] {
  return (
    Array.isArray(valor) && valor.length <= MAXIMO_TRABAJADORES_POR_ASIGNACION && valor.every((v) => esUUID(v))
  );
}

export function validarAltaAsignacion(req: Request, res: Response, next: NextFunction): void {
  const { seccionId, fecha, trabajadorIds } = req.body ?? {};

  if (!esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esFechaISO(fecha)) {
    res.status(400).json({ error: "fecha es requerida en formato YYYY-MM-DD." });
    return;
  }

  if (!esArregloDeUUIDs(trabajadorIds)) {
    res.status(400).json({ error: "trabajadorIds es requerido y debe ser un arreglo de UUIDs válidos." });
    return;
  }

  next();
}

export function validarSugerenciaAsignacion(req: Request, res: Response, next: NextFunction): void {
  const { seccionId, fecha } = req.query;

  if (!esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId (query) es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esFechaISO(fecha)) {
    res.status(400).json({ error: "fecha (query) es requerida en formato YYYY-MM-DD." });
    return;
  }

  next();
}

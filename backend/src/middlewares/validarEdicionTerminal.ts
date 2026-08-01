import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_TEXTO = 200;

export function validarEdicionTerminal(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del terminal en la URL debe ser un UUID válido." });
    return;
  }

  const body = req.body ?? {};
  const { ubicacion, numeroSerie, activo } = body;

  if (ubicacion !== undefined && !esStringNoVacia(ubicacion, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "ubicacion debe ser un texto válido." });
    return;
  }

  if (numeroSerie !== undefined && numeroSerie !== null && !esStringNoVacia(numeroSerie, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "numeroSerie debe ser un texto válido si se envía." });
    return;
  }

  if (activo !== undefined && typeof activo !== "boolean") {
    res.status(400).json({ error: "activo debe ser true o false." });
    return;
  }

  next();
}

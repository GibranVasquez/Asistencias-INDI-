import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID, validarFortalezaPassword } from "../utils/validacion";

const LONGITUD_MAXIMA_PASSWORD = 200;

export function validarReseteoPassword(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del usuario en la URL debe ser un UUID válido." });
    return;
  }

  if (!esStringNoVacia(req.body?.passwordTemporal, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "passwordTemporal es requerido y debe ser un texto válido." });
    return;
  }

  const errorFortaleza = validarFortalezaPassword(req.body.passwordTemporal);
  if (errorFortaleza) {
    res.status(400).json({ error: errorFortaleza });
    return;
  }

  next();
}

export function validarCambioPropiaPassword(req: Request, res: Response, next: NextFunction): void {
  if (!esStringNoVacia(req.body?.passwordActual, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "passwordActual es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(req.body?.passwordNueva, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "passwordNueva es requerido y debe ser un texto válido." });
    return;
  }

  const errorFortaleza = validarFortalezaPassword(req.body.passwordNueva);
  if (errorFortaleza) {
    res.status(400).json({ error: errorFortaleza });
    return;
  }

  next();
}

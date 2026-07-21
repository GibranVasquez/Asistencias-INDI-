import { NextFunction, Request, Response } from "express";
import { esStringNoVacia } from "../utils/validacion";

const LONGITUD_MAXIMA_USUARIO = 100;
const LONGITUD_MAXIMA_PASSWORD = 200;
const LONGITUD_MAXIMA_TEXTO = 200;

export function validarAltaTerminal(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { username, password, tipo, ubicacion } = body;

  if (!esStringNoVacia(username, LONGITUD_MAXIMA_USUARIO)) {
    res.status(400).json({ error: "username es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(password, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "password es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(tipo, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "tipo es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(ubicacion, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "ubicacion es requerida y debe ser un texto válido." });
    return;
  }

  next();
}

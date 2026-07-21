import { NextFunction, Request, Response } from "express";
import { esStringNoVacia } from "../utils/validacion";

const LONGITUD_MAXIMA_USUARIO = 100;
const LONGITUD_MAXIMA_PASSWORD = 200;

export function validarLogin(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { username, password } = body;

  if (!esStringNoVacia(username, LONGITUD_MAXIMA_USUARIO)) {
    res.status(400).json({ error: "username es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(password, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "password es requerido y debe ser un texto válido." });
    return;
  }

  next();
}

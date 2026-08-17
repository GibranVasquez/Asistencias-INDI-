import { NextFunction, Request, Response } from "express";
import { esStringNoVacia } from "../utils/validacion";

export function validarEdicionObra(req: Request, res: Response, next: NextFunction): void {
  if (!esStringNoVacia(req.body?.nombre, 200)) {
    res.status(400).json({ error: "nombre es requerido y debe ser un texto válido." });
    return;
  }
  next();
}

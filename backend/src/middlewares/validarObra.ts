import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esTimezoneIANA } from "../utils/validacion";

export function validarEdicionObra(req: Request, res: Response, next: NextFunction): void {
  if (!esStringNoVacia(req.body?.nombre, 200)) {
    res.status(400).json({ error: "nombre es requerido y debe ser un texto válido." });
    return;
  }
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "timezoneObra") && !esTimezoneIANA(req.body.timezoneObra)) {
    res.status(400).json({ error: "timezoneObra debe ser una zona horaria IANA válida." });
    return;
  }
  next();
}

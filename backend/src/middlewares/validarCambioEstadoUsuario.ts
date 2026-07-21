import { NextFunction, Request, Response } from "express";
import { esUUID } from "../utils/validacion";

export function validarCambioEstadoUsuario(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del usuario en la URL debe ser un UUID válido." });
    return;
  }

  if (typeof req.body?.activo !== "boolean") {
    res.status(400).json({ error: "activo es requerido y debe ser true o false." });
    return;
  }

  next();
}

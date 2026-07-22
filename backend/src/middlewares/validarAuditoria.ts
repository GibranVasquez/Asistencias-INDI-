import { NextFunction, Request, Response } from "express";
import { esUUID } from "../utils/validacion";

export function validarFiltroAuditoria(req: Request, res: Response, next: NextFunction): void {
  const { entidad, entidadId } = req.query;

  if (entidad !== undefined && typeof entidad !== "string") {
    res.status(400).json({ error: "entidad debe ser un texto si se envía." });
    return;
  }

  if (entidadId !== undefined && !esUUID(entidadId)) {
    res.status(400).json({ error: "entidadId debe ser un UUID válido si se envía." });
    return;
  }

  next();
}

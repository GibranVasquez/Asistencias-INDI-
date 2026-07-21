import { NextFunction, Request, Response } from "express";
import { esUUID, validarMontosNomina } from "../utils/validacion";

export function validarCorreccionNomina(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la nómina en la URL debe ser un UUID válido." });
    return;
  }

  const errorMontos = validarMontosNomina(req.body ?? {});
  if (errorMontos) {
    res.status(400).json({ error: errorMontos });
    return;
  }

  next();
}

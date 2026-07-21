import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_NOMBRE = 100;

function validarCamposTipoMovimiento(body: Record<string, unknown>): string | null {
  const { nombre, cuentaComoDiaTrabajado, esInformativo, requiereAutorizacion } = body;

  if (!esStringNoVacia(nombre, LONGITUD_MAXIMA_NOMBRE)) {
    return "nombre es requerido y debe ser un texto válido.";
  }
  if (typeof cuentaComoDiaTrabajado !== "boolean") {
    return "cuentaComoDiaTrabajado es requerido y debe ser true o false.";
  }
  if (typeof esInformativo !== "boolean") {
    return "esInformativo es requerido y debe ser true o false.";
  }
  if (typeof requiereAutorizacion !== "boolean") {
    return "requiereAutorizacion es requerido y debe ser true o false.";
  }

  return null;
}

export function validarAltaTipoMovimiento(req: Request, res: Response, next: NextFunction): void {
  const error = validarCamposTipoMovimiento(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarEdicionTipoMovimiento(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del tipo de movimiento en la URL debe ser un UUID válido." });
    return;
  }

  const error = validarCamposTipoMovimiento(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarIdTipoMovimiento(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del tipo de movimiento en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

import { NextFunction, Request, Response } from "express";
import { esFechaISO, esUUID } from "../utils/validacion";

function esValorPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function validarCamposTarifaHoraExtra(body: Record<string, unknown>): string | null {
  const { valor, vigenteDesde } = body;

  if (!esValorPositivo(valor)) {
    return "valor es requerido y debe ser un número mayor a 0.";
  }
  if (!esFechaISO(vigenteDesde)) {
    return "vigenteDesde es requerido en formato YYYY-MM-DD.";
  }

  return null;
}

export function validarAltaTarifaHoraExtra(req: Request, res: Response, next: NextFunction): void {
  const error = validarCamposTarifaHoraExtra(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarEdicionTarifaHoraExtra(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la tarifa en la URL debe ser un UUID válido." });
    return;
  }

  const error = validarCamposTarifaHoraExtra(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarIdTarifaHoraExtra(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la tarifa en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

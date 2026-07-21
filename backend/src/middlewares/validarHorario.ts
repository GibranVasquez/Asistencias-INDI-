import { NextFunction, Request, Response } from "express";
import { esEnteroNoNegativo, esHora, esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_NOMBRE = 100;

function validarCamposHorario(body: Record<string, unknown>): string | null {
  const { nombre, horaEntrada, horaSalida, toleranciaMinutos, recesoInicio, recesoFin } = body;

  if (!esStringNoVacia(nombre, LONGITUD_MAXIMA_NOMBRE)) {
    return "nombre es requerido y debe ser un texto válido.";
  }
  if (!esHora(horaEntrada)) {
    return "horaEntrada es requerida en formato HH:MM o HH:MM:SS.";
  }
  if (!esHora(horaSalida)) {
    return "horaSalida es requerida en formato HH:MM o HH:MM:SS.";
  }
  if (!esEnteroNoNegativo(toleranciaMinutos)) {
    return "toleranciaMinutos es requerido y debe ser un entero mayor o igual a 0.";
  }

  const tieneRecesoInicio = recesoInicio !== undefined && recesoInicio !== null;
  const tieneRecesoFin = recesoFin !== undefined && recesoFin !== null;
  if (tieneRecesoInicio !== tieneRecesoFin) {
    return "recesoInicio y recesoFin deben capturarse juntos o no capturarse ninguno.";
  }
  if (tieneRecesoInicio && !esHora(recesoInicio)) {
    return "recesoInicio debe ser una hora válida (HH:MM o HH:MM:SS).";
  }
  if (tieneRecesoFin && !esHora(recesoFin)) {
    return "recesoFin debe ser una hora válida (HH:MM o HH:MM:SS).";
  }

  return null;
}

export function validarAltaHorario(req: Request, res: Response, next: NextFunction): void {
  const error = validarCamposHorario(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarEdicionHorario(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del horario en la URL debe ser un UUID válido." });
    return;
  }

  const error = validarCamposHorario(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarIdHorario(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del horario en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

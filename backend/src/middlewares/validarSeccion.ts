import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_NOMBRE = 150;

// horarioId es opcional: undefined/ausente (no se manda), o null (se manda
// explicitamente para desasignar), o un UUID valido. Cualquier otra cosa
// (numero, string no-UUID, etc.) es invalido.
function horarioIdValido(valor: unknown): boolean {
  return valor === undefined || valor === null || esUUID(valor);
}

function encargadoIdsValidos(valor: unknown): boolean {
  return valor === undefined || (Array.isArray(valor) && valor.every((v) => esUUID(v)));
}

export function validarAltaSeccion(req: Request, res: Response, next: NextFunction): void {
  const { obraId, nombre, horarioId, encargadoIds } = req.body ?? {};

  if (!esUUID(obraId)) {
    res.status(400).json({ error: "obraId es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esStringNoVacia(nombre, LONGITUD_MAXIMA_NOMBRE)) {
    res.status(400).json({ error: "nombre es requerido y debe ser un texto válido." });
    return;
  }

  if (!horarioIdValido(horarioId)) {
    res.status(400).json({ error: "horarioId debe ser un UUID válido, null, u omitirse." });
    return;
  }

  if (!encargadoIdsValidos(encargadoIds)) {
    res.status(400).json({ error: "encargadoIds debe ser un arreglo de UUIDs si se envía." });
    return;
  }

  next();
}

export function validarEdicionSeccion(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la sección en la URL debe ser un UUID válido." });
    return;
  }

  if (!esStringNoVacia(req.body?.nombre, LONGITUD_MAXIMA_NOMBRE)) {
    res.status(400).json({ error: "nombre es requerido y debe ser un texto válido." });
    return;
  }

  if (!horarioIdValido(req.body?.horarioId)) {
    res.status(400).json({ error: "horarioId debe ser un UUID válido, null, u omitirse." });
    return;
  }

  if (!encargadoIdsValidos(req.body?.encargadoIds)) {
    res.status(400).json({ error: "encargadoIds debe ser un arreglo de UUIDs si se envía." });
    return;
  }

  next();
}

export function validarIdSeccion(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la sección en la URL debe ser un UUID válido." });
    return;
  }

  next();
}

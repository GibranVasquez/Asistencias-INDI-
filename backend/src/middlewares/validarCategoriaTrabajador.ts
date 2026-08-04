import { NextFunction, Request, Response } from "express";
import { esNumeroNoNegativo, esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_NOMBRE = 100;

function validarCamposCategoria(body: Record<string, unknown>): string | null {
  const { nombre, sueldoBaseDefault, esDefault } = body;

  if (!esStringNoVacia(nombre, LONGITUD_MAXIMA_NOMBRE)) {
    return "nombre es requerido y debe ser un texto válido.";
  }
  if (sueldoBaseDefault !== null && !esNumeroNoNegativo(sueldoBaseDefault)) {
    return "sueldoBaseDefault debe ser un número mayor o igual a 0, o null.";
  }
  if (typeof esDefault !== "boolean") {
    return "esDefault es requerido y debe ser true o false.";
  }

  return null;
}

export function validarAltaCategoriaTrabajador(req: Request, res: Response, next: NextFunction): void {
  const error = validarCamposCategoria(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarEdicionCategoriaTrabajador(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la categoría en la URL debe ser un UUID válido." });
    return;
  }

  const error = validarCamposCategoria(req.body ?? {});
  if (error) {
    res.status(400).json({ error });
    return;
  }
  next();
}

export function validarIdCategoriaTrabajador(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la categoría en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

export function validarAplicarATodos(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id de la categoría en la URL debe ser un UUID válido." });
    return;
  }
  if (!esNumeroNoNegativo(req.body?.nuevoSueldoBase)) {
    res.status(400).json({ error: "nuevoSueldoBase es requerido y debe ser un número mayor o igual a 0." });
    return;
  }
  next();
}

import { NextFunction, Request, Response } from "express";
import { TrabajadorEstatus, TrabajadorTipo } from "@prisma/client";
import { esEnteroNoNegativo, esFechaISO, esNumeroNoNegativo, esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_TEXTO = 200;

function esTrabajadorTipo(valor: unknown): valor is TrabajadorTipo {
  return typeof valor === "string" && Object.values(TrabajadorTipo).includes(valor as TrabajadorTipo);
}

function esTrabajadorEstatus(valor: unknown): valor is TrabajadorEstatus {
  return typeof valor === "string" && Object.values(TrabajadorEstatus).includes(valor as TrabajadorEstatus);
}

/**
 * Valida los campos opcionales de nómina/enrolamiento compartidos entre alta
 * y edición. Todos son opcionales porque el alta biométrica no los trae —
 * RH los completa después vía PATCH.
 */
function validarCamposOpcionales(body: Record<string, unknown>): string | null {
  const {
    tipo,
    fechaIngreso,
    sueldoBase,
    banco,
    clabe,
    cuentaBancaria,
    infonavitPlazoMeses,
    infonavitMontoPorPeriodo,
    huellaRegistrada,
    rostroRegistrado,
    numeroChecador,
    estatus,
  } = body;

  if (tipo !== undefined && !esTrabajadorTipo(tipo)) {
    return "tipo debe ser uno de: empleado, contratista, becario.";
  }
  if (estatus !== undefined && !esTrabajadorEstatus(estatus)) {
    return "estatus debe ser uno de: activo, baja.";
  }
  if (fechaIngreso !== undefined && fechaIngreso !== null && !esFechaISO(fechaIngreso)) {
    return "fechaIngreso debe ser una fecha válida en formato YYYY-MM-DD.";
  }
  if (sueldoBase !== undefined && sueldoBase !== null && !esNumeroNoNegativo(sueldoBase)) {
    return "sueldoBase debe ser un número mayor o igual a 0.";
  }
  if (banco !== undefined && banco !== null && !esStringNoVacia(banco, LONGITUD_MAXIMA_TEXTO)) {
    return "banco debe ser un texto válido.";
  }
  if (clabe !== undefined && clabe !== null && !esStringNoVacia(clabe, LONGITUD_MAXIMA_TEXTO)) {
    return "clabe debe ser un texto válido.";
  }
  if (cuentaBancaria !== undefined && cuentaBancaria !== null && !esStringNoVacia(cuentaBancaria, LONGITUD_MAXIMA_TEXTO)) {
    return "cuentaBancaria debe ser un texto válido.";
  }
  if (infonavitPlazoMeses !== undefined && infonavitPlazoMeses !== null && !esEnteroNoNegativo(infonavitPlazoMeses)) {
    return "infonavitPlazoMeses debe ser un entero mayor o igual a 0.";
  }
  if (
    infonavitMontoPorPeriodo !== undefined &&
    infonavitMontoPorPeriodo !== null &&
    !esNumeroNoNegativo(infonavitMontoPorPeriodo)
  ) {
    return "infonavitMontoPorPeriodo debe ser un número mayor o igual a 0.";
  }
  if (huellaRegistrada !== undefined && typeof huellaRegistrada !== "boolean") {
    return "huellaRegistrada debe ser true o false.";
  }
  if (rostroRegistrado !== undefined && typeof rostroRegistrado !== "boolean") {
    return "rostroRegistrado debe ser true o false.";
  }
  if (numeroChecador !== undefined && numeroChecador !== null && !esEnteroNoNegativo(numeroChecador)) {
    return "numeroChecador debe ser un entero mayor o igual a 0.";
  }

  return null;
}

export function validarAltaTrabajador(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { nombreCompleto, categoria, jefeInmediato } = body;

  if (!esStringNoVacia(nombreCompleto, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "nombreCompleto es requerido y debe ser un texto válido." });
    return;
  }
  if (!esStringNoVacia(categoria, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "categoria es requerida y debe ser un texto válido." });
    return;
  }
  if (!esStringNoVacia(jefeInmediato, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "jefeInmediato es requerido y debe ser un texto válido." });
    return;
  }

  const error = validarCamposOpcionales(body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  next();
}

export function validarEdicionTrabajador(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del trabajador en la URL debe ser un UUID válido." });
    return;
  }

  const body = req.body ?? {};
  const { nombreCompleto, categoria, jefeInmediato } = body;

  if (nombreCompleto !== undefined && !esStringNoVacia(nombreCompleto, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "nombreCompleto debe ser un texto válido." });
    return;
  }
  if (categoria !== undefined && !esStringNoVacia(categoria, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "categoria debe ser un texto válido." });
    return;
  }
  if (jefeInmediato !== undefined && !esStringNoVacia(jefeInmediato, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "jefeInmediato debe ser un texto válido." });
    return;
  }

  const error = validarCamposOpcionales(body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  next();
}

export function validarIdTrabajador(req: Request, res: Response, next: NextFunction): void {
  if (!esUUID(req.params.id)) {
    res.status(400).json({ error: "El id del trabajador en la URL debe ser un UUID válido." });
    return;
  }
  next();
}

export function validarAplicarSueldoMasivo(req: Request, res: Response, next: NextFunction): void {
  const { ids, nuevoSueldoBase } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => esUUID(id))) {
    res.status(400).json({ error: "ids es requerido y debe ser un arreglo no vacío de UUIDs válidos." });
    return;
  }
  if (!esNumeroNoNegativo(nuevoSueldoBase)) {
    res.status(400).json({ error: "nuevoSueldoBase es requerido y debe ser un número mayor o igual a 0." });
    return;
  }

  next();
}

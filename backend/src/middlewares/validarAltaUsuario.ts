import { NextFunction, Request, Response } from "express";
import { RolUsuario } from "@prisma/client";
import { esStringNoVacia, esUUID, validarFortalezaPassword } from "../utils/validacion";

const LONGITUD_MAXIMA_USUARIO = 100;
const LONGITUD_MAXIMA_PASSWORD = 200;

function esRolUsuario(valor: unknown): valor is RolUsuario {
  return typeof valor === "string" && Object.values(RolUsuario).includes(valor as RolUsuario);
}

function esArregloDeUUIDs(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((v) => esUUID(v));
}

export function validarAltaUsuario(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { username, password, rol, trabajadorId, seccionesAsignadas } = body;

  if (!esStringNoVacia(username, LONGITUD_MAXIMA_USUARIO)) {
    res.status(400).json({ error: "username es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(password, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "password es requerido y debe ser un texto válido." });
    return;
  }

  const errorFortaleza = validarFortalezaPassword(password);
  if (errorFortaleza) {
    res.status(400).json({ error: errorFortaleza });
    return;
  }

  if (!esRolUsuario(rol)) {
    res.status(400).json({ error: "rol es requerido y debe ser uno de los roles válidos." });
    return;
  }

  if (rol === RolUsuario.trabajador || rol === RolUsuario.encargado_seccion) {
    // Un encargado puede tener además una identidad de Trabajador para
    // registrar asistencia; son permisos de aplicación independientes.
    if (rol === RolUsuario.trabajador && !esUUID(trabajadorId)) {
      res.status(400).json({ error: "trabajadorId es requerido y debe ser un UUID válido para cuentas rol=trabajador." });
      return;
    }
    if (rol === RolUsuario.encargado_seccion && trabajadorId !== undefined && trabajadorId !== null && !esUUID(trabajadorId)) {
      res.status(400).json({ error: "trabajadorId debe ser un UUID válido cuando se vincula una cuenta." });
      return;
    }
  } else {
    if (trabajadorId !== undefined && trabajadorId !== null) {
      res.status(400).json({ error: "trabajadorId solo aplica para cuentas rol=trabajador o encargado_seccion." });
      return;
    }
  }

  if (seccionesAsignadas !== undefined && !esArregloDeUUIDs(seccionesAsignadas)) {
    res.status(400).json({ error: "seccionesAsignadas debe ser un arreglo de UUIDs." });
    return;
  }

  if (rol === RolUsuario.encargado_seccion) {
    if (!seccionesAsignadas || seccionesAsignadas.length === 0) {
      res.status(400).json({
        error: "seccionesAsignadas es requerido (al menos una) para cuentas rol=encargado_seccion.",
      });
      return;
    }
  } else if (seccionesAsignadas && seccionesAsignadas.length > 0) {
    res.status(400).json({ error: "seccionesAsignadas solo aplica para cuentas rol=encargado_seccion." });
    return;
  }

  next();
}

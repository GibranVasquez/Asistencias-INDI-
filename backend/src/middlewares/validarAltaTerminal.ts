import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_USUARIO = 100;
const LONGITUD_MAXIMA_PASSWORD = 200;
const LONGITUD_MAXIMA_TEXTO = 200;

export function validarAltaTerminal(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const { username, password, tipo, ubicacion, numeroSerie, obraId } = body;

  if (!esStringNoVacia(username, LONGITUD_MAXIMA_USUARIO)) {
    res.status(400).json({ error: "username es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(tipo, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "tipo es requerido y debe ser un texto válido." });
    return;
  }

  // tipo="adms" nunca puede iniciar sesión (terminalAuth.service.ts lo
  // rechaza explícitamente) - su password se genera en el servidor
  // (terminal.service.ts), nunca la escribe un administrador ni viaja en
  // la petición.
  if (tipo !== "adms" && !esStringNoVacia(password, LONGITUD_MAXIMA_PASSWORD)) {
    res.status(400).json({ error: "password es requerido y debe ser un texto válido." });
    return;
  }

  if (!esStringNoVacia(ubicacion, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "ubicacion es requerida y debe ser un texto válido." });
    return;
  }

  // Solo aplica a terminales tipo="adms" (ver schema.prisma) — un terminal
  // con sesión JWT propia (login-terminal) no lo necesita.
  if (numeroSerie !== undefined && numeroSerie !== null && !esStringNoVacia(numeroSerie, LONGITUD_MAXIMA_TEXTO)) {
    res.status(400).json({ error: "numeroSerie debe ser un texto válido si se envía." });
    return;
  }

  if (tipo === "adms") {
    if (!esStringNoVacia(numeroSerie, LONGITUD_MAXIMA_TEXTO)) {
      res.status(400).json({ error: "numeroSerie es requerido para terminales ADMS." });
      return;
    }
    if (!esUUID(obraId)) {
      res.status(400).json({ error: "obraId es requerido para terminales ADMS." });
      return;
    }
  }

  if (obraId !== undefined && obraId !== null && !esUUID(obraId)) {
    res.status(400).json({ error: "obraId debe ser un UUID válido si se envía." });
    return;
  }

  next();
}

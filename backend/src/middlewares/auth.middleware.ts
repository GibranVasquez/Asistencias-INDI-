import { NextFunction, Request, Response } from "express";
import { esAuthTokenPayload } from "../types/auth";
import { verificarTokenJWT } from "../utils/jwt";

const MENSAJE_NO_AUTORIZADO = "No autorizado.";

function rechazar(res: Response, motivoInterno: string): void {
  // El motivo detallado solo se registra en el log del servidor; el cliente
  // siempre recibe el mismo mensaje genérico, sin pistas sobre la causa.
  console.warn(`[auth] acceso rechazado: ${motivoInterno}`);
  res.status(401).json({ error: MENSAJE_NO_AUTORIZADO });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[auth] JWT_SECRET no está configurado en el servidor");
    res.status(500).json({ error: "Error interno del servidor" });
    return;
  }

  const resultado = verificarTokenJWT(req.header("authorization"), secret);
  if (!resultado.valido) {
    rechazar(res, resultado.motivo);
    return;
  }

  if (!esAuthTokenPayload(resultado.payload)) {
    rechazar(res, "el token es válido pero su contenido no tiene el formato esperado");
    return;
  }

  req.user = resultado.payload;
  next();
}

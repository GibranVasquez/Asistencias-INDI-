import { NextFunction, Request, Response } from "express";
import { esAuthTokenPayload } from "../types/auth";
import { prisma } from "../utils/prisma";
import { verificarTokenJWT } from "../utils/jwt";

const MENSAJE_NO_AUTORIZADO = "No autorizado.";

function rechazar(res: Response, motivoInterno: string): void {
  // El motivo detallado solo se registra en el log del servidor; el cliente
  // siempre recibe el mismo mensaje genérico, sin pistas sobre la causa.
  console.warn(`[auth] acceso rechazado: ${motivoInterno}`);
  res.status(401).json({ error: MENSAJE_NO_AUTORIZADO });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  // Se re-consulta la BD en cada request (mismo criterio que
  // terminalAuthMiddleware con Terminal.activo) — sin esto, un administrador
  // que da de baja a un empleado despedido esperaría efecto inmediato, pero
  // el JWT ya emitido (hasta 8h) seguía funcionando igual hasta su expiración
  // natural. Distinto del trade-off ya aceptado de "logout no invalida el
  // JWT" (ver CLAUDE.md): ese es sobre el propio usuario cerrando su
  // sesión; esto es sobre una acción administrativa explícita de un tercero.
  const usuario = await prisma.usuario.findUnique({ where: { id: resultado.payload.usuarioId } });
  if (!usuario || !usuario.activo) {
    rechazar(res, "el usuario no existe o fue dado de baja");
    return;
  }

  req.user = resultado.payload;
  next();
}

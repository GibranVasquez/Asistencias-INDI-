import { NextFunction, Request, Response } from "express";
import { esAuthTerminalTokenPayload } from "../types/authTerminal";
import { prisma } from "../utils/prisma";
import { verificarTokenJWT } from "../utils/jwt";

const MENSAJE_NO_AUTORIZADO = "No autorizado.";

function rechazar(res: Response, motivoInterno: string): void {
  console.warn(`[auth-terminal] acceso rechazado: ${motivoInterno}`);
  res.status(401).json({ error: MENSAJE_NO_AUTORIZADO });
}

export async function terminalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[auth-terminal] JWT_SECRET no está configurado en el servidor");
    res.status(500).json({ error: "Error interno del servidor" });
    return;
  }

  const resultado = verificarTokenJWT(req.header("authorization"), secret);
  if (!resultado.valido) {
    rechazar(res, resultado.motivo);
    return;
  }

  if (!esAuthTerminalTokenPayload(resultado.payload)) {
    rechazar(res, "el token es válido pero su contenido no tiene el formato esperado");
    return;
  }

  // A diferencia de authMiddleware (humanos), aquí sí se re-consulta la BD en
  // cada request: un terminal dado de baja debe perder acceso de inmediato,
  // no hasta que su token expire.
  const terminal = await prisma.terminal.findUnique({ where: { id: resultado.payload.terminalId } });
  if (!terminal || !terminal.activo) {
    rechazar(res, "el terminal no existe o está desactivado");
    return;
  }

  req.terminal = { terminalId: terminal.id };
  next();
}

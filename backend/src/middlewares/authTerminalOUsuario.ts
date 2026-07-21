import { NextFunction, Request, Response } from "express";
import { RolUsuario } from "@prisma/client";
import { esAuthTokenPayload } from "../types/auth";
import { esAuthTerminalTokenPayload } from "../types/authTerminal";
import { verificarTokenJWT } from "../utils/jwt";
import { prisma } from "../utils/prisma";

const MENSAJE_NO_AUTORIZADO = "No autorizado.";
const MENSAJE_SIN_PERMISO = "No tienes permiso para realizar esta acción.";

function rechazar(res: Response, motivoInterno: string, status: 401 | 403 = 401): void {
  console.warn(`[auth-terminal-o-usuario] acceso rechazado: ${motivoInterno}`);
  res.status(status).json({ error: status === 401 ? MENSAJE_NO_AUTORIZADO : MENSAJE_SIN_PERMISO });
}

/**
 * Para catalogos de solo lectura (secciones, horarios) que un Terminal
 * (kiosco) necesita consultar para operar, sin heredar ningun permiso de
 * escritura de RH. Acepta:
 *  - un Terminal activo (sin restriccion de rol — nunca se monta en rutas
 *    de escritura, asi que "acceso total" aqui sigue siendo solo lectura), o
 *  - un Usuario humano cuyo rol este en `rolesUsuario`.
 * A diferencia de authMiddleware/terminalAuthMiddleware, este intenta
 * ambas formas de token en vez de asumir una sola.
 */
export function permitirTerminalOUsuarioConRol(...rolesUsuario: RolUsuario[]) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[auth-terminal-o-usuario] JWT_SECRET no está configurado en el servidor");
      res.status(500).json({ error: "Error interno del servidor" });
      return;
    }

    const resultado = verificarTokenJWT(req.header("authorization"), secret);
    if (!resultado.valido) {
      rechazar(res, resultado.motivo);
      return;
    }

    if (esAuthTerminalTokenPayload(resultado.payload)) {
      const terminal = await prisma.terminal.findUnique({ where: { id: resultado.payload.terminalId } });
      if (!terminal || !terminal.activo) {
        rechazar(res, "el terminal no existe o está desactivado");
        return;
      }
      req.terminal = { terminalId: terminal.id };
      next();
      return;
    }

    if (esAuthTokenPayload(resultado.payload)) {
      if (!rolesUsuario.includes(resultado.payload.rol)) {
        rechazar(res, `rol ${resultado.payload.rol} no autorizado para este recurso`, 403);
        return;
      }
      req.user = resultado.payload;
      next();
      return;
    }

    rechazar(res, "el token es válido pero su contenido no tiene el formato esperado");
  };
}

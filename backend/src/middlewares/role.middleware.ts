import { NextFunction, Request, Response } from "express";
import { RolUsuario } from "@prisma/client";

export function permitirRoles(...roles: RolUsuario[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    // Si authMiddleware no corrió antes (ruta mal armada, orden incorrecto,
    // etc.), req.user no existe: se rechaza en vez de leer req.user.rol y tronar.
    if (!req.user) {
      res.status(401).json({ error: "No autorizado." });
      return;
    }

    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
      return;
    }

    next();
  };
}

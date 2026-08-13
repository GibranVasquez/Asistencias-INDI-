import { NextFunction, Request, Response } from "express";
import { mantenimientoActivo } from "../config/maintenance";

export function bloquearDuranteMantenimiento(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "OPTIONS" || req.path === "/health" || !mantenimientoActivo()) return next();
  res.status(503).json({ error: "MAINTENANCE_MODE", message: "El sistema se encuentra temporalmente en mantenimiento." });
}

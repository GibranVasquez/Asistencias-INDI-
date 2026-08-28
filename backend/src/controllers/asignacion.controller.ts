import { Request, Response } from "express";
import { asignarSeccionDelDia, obtenerAsignacionesActuales, obtenerSugerenciaAsignacion } from "../services/asignacion.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const { asignaciones, movidos } = await asignarSeccionDelDia(req.user!.usuarioId, req.user!.rol, req.body);
  res.status(201).json({ asignaciones, movidos });
}

export async function sugerencia(req: Request, res: Response): Promise<void> {
  const seccionId = req.query.seccionId as string;
  const fecha = req.query.fecha as string;
  const resultado = await obtenerSugerenciaAsignacion(req.user!.usuarioId, req.user!.rol, seccionId, fecha);
  res.json(resultado);
}

export async function listar(req: Request, res: Response): Promise<void> {
  const resultado = await obtenerAsignacionesActuales(req.user!.usuarioId, req.user!.rol, req.query.seccionId as string, req.query.fecha as string);
  res.json(resultado);
}

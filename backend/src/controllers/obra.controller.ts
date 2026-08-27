import { Request, Response } from "express";
import { editarObraActual, listarObras, obtenerObraActual } from "../services/obra.service";

export async function listar(_req: Request, res: Response): Promise<void> {
  res.json({ obras: await listarObras() });
}

export async function obtenerActual(_req: Request, res: Response): Promise<void> {
  res.json({ obra: await obtenerObraActual() });
}

export async function editarActual(req: Request, res: Response): Promise<void> {
  res.json({ obra: await editarObraActual(req.user!.usuarioId, req.body.nombre.trim(), req.body.timezoneObra) });
}

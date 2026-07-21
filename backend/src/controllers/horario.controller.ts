import { Request, Response } from "express";
import { borrarHorario, crearHorario, editarHorario, listarHorarios, obtenerHorario } from "../services/horario.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const horario = await crearHorario(req.body);
  res.status(201).json({ horario });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const horarios = await listarHorarios();
  res.json({ horarios });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const horario = await obtenerHorario(req.params.id as string);
  res.json({ horario });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const horario = await editarHorario(req.params.id as string, req.body);
  res.json({ horario });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarHorario(req.params.id as string);
  res.status(204).send();
}

import { Request, Response } from "express";
import {
  cambiarEstadoUsuario,
  crearUsuario,
  listarEncargados,
  listarUsuarios,
  resetearPassword,
} from "../services/usuario.service";

export async function listar(_req: Request, res: Response): Promise<void> {
  const usuarios = await listarUsuarios();
  res.json({ usuarios });
}

export async function encargados(_req: Request, res: Response): Promise<void> {
  const usuarios = await listarEncargados();
  res.json({ usuarios });
}

export async function crear(req: Request, res: Response): Promise<void> {
  const usuario = await crearUsuario(req.user!.usuarioId, req.body);
  res.status(201).json({ usuario });
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const usuarioId = req.params.id as string;
  const usuario = await cambiarEstadoUsuario(req.user!.usuarioId, usuarioId, req.body.activo);
  res.json({ usuario });
}

export async function resetear(req: Request, res: Response): Promise<void> {
  const usuarioId = req.params.id as string;
  await resetearPassword(req.user!.usuarioId, usuarioId, req.body.passwordTemporal);
  res.status(204).send();
}

import { Request, Response } from "express";
import { cambiarEstadoUsuario, crearUsuario, listarUsuarios } from "../services/usuario.service";

export async function listar(_req: Request, res: Response): Promise<void> {
  const usuarios = await listarUsuarios();
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

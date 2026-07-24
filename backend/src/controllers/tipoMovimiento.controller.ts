import { Request, Response } from "express";
import {
  borrarTipoMovimiento,
  crearTipoMovimiento,
  editarTipoMovimiento,
  listarTiposMovimiento,
  obtenerTipoMovimiento,
} from "../services/tipoMovimiento.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const tipoMovimiento = await crearTipoMovimiento(req.user!.usuarioId, req.body);
  res.status(201).json({ tipoMovimiento });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const tiposMovimiento = await listarTiposMovimiento();
  res.json({ tiposMovimiento });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const tipoMovimiento = await obtenerTipoMovimiento(req.params.id as string);
  res.json({ tipoMovimiento });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const tipoMovimiento = await editarTipoMovimiento(req.user!.usuarioId, req.params.id as string, req.body);
  res.json({ tipoMovimiento });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarTipoMovimiento(req.user!.usuarioId, req.params.id as string);
  res.status(204).send();
}

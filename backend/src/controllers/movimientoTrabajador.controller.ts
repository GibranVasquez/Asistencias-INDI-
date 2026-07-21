import { Request, Response } from "express";
import {
  borrarMovimiento,
  crearMovimiento,
  editarMovimiento,
  listarMovimientos,
  obtenerMovimiento,
} from "../services/movimientoTrabajador.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const movimiento = await crearMovimiento(req.body);
  res.status(201).json({ movimiento });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const trabajadorId = req.query.trabajadorId as string | undefined;
  const movimientos = await listarMovimientos(trabajadorId);
  res.json({ movimientos });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const movimiento = await obtenerMovimiento(req.params.id as string);
  res.json({ movimiento });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const movimiento = await editarMovimiento(req.params.id as string, req.body);
  res.json({ movimiento });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarMovimiento(req.params.id as string);
  res.status(204).send();
}

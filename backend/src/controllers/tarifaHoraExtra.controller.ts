import { Request, Response } from "express";
import {
  borrarTarifaHoraExtra,
  crearTarifaHoraExtra,
  editarTarifaHoraExtra,
  listarTarifasHoraExtra,
  obtenerTarifaHoraExtra,
} from "../services/tarifaHoraExtra.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const tarifa = await crearTarifaHoraExtra(req.body);
  res.status(201).json({ tarifa });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const tarifas = await listarTarifasHoraExtra();
  res.json({ tarifas });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const tarifa = await obtenerTarifaHoraExtra(req.params.id as string);
  res.json({ tarifa });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const tarifa = await editarTarifaHoraExtra(req.params.id as string, req.body);
  res.json({ tarifa });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarTarifaHoraExtra(req.params.id as string);
  res.status(204).send();
}

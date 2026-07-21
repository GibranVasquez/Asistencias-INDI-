import { Request, Response } from "express";
import {
  corregirNominaSemanal,
  generarNominaSemanal,
  listarNominasSemanales,
  obtenerNominaSemanal,
} from "../services/nomina.service";

export async function generar(req: Request, res: Response): Promise<void> {
  const { trabajadorId, ...datos } = req.body;
  const nomina = await generarNominaSemanal(req.user!.usuarioId, trabajadorId, datos);
  res.status(201).json({ nomina });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const trabajadorId = req.query.trabajadorId as string | undefined;
  const nominas = await listarNominasSemanales({ trabajadorId });
  res.json({ nominas });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const nomina = await obtenerNominaSemanal(req.params.id as string);
  res.json({ nomina });
}

export async function corregir(req: Request, res: Response): Promise<void> {
  // validarCorreccionNomina ya garantizó que req.params.id es un UUID (string).
  const nominaId = req.params.id as string;
  const nomina = await corregirNominaSemanal(req.user!.usuarioId, nominaId, req.body);
  res.json({ nomina });
}

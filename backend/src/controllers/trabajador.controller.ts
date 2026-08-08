import { Request, Response } from "express";
import {
  aplicarSueldoATrabajadores,
  borrarTrabajador,
  crearTrabajador,
  editarTrabajador,
  listarTrabajadores,
  listarTrabajadoresBasico,
  obtenerTrabajador,
} from "../services/trabajador.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const trabajador = await crearTrabajador(req.user!.usuarioId, req.body);
  res.status(201).json({ trabajador });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const trabajadores = await listarTrabajadores();
  res.json({ trabajadores });
}

export async function basico(_req: Request, res: Response): Promise<void> {
  const trabajadores = await listarTrabajadoresBasico();
  res.json({ trabajadores });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const trabajador = await obtenerTrabajador(req.params.id as string);
  res.json({ trabajador });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const trabajador = await editarTrabajador(req.user!.usuarioId, req.params.id as string, req.body);
  res.json({ trabajador });
}

export async function aplicarSueldo(req: Request, res: Response): Promise<void> {
  const resultado = await aplicarSueldoATrabajadores(
    req.user!.usuarioId,
    req.body.ids,
    req.body.nuevoSueldoBase
  );
  res.json(resultado);
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarTrabajador(req.user!.usuarioId, req.params.id as string);
  res.status(204).send();
}

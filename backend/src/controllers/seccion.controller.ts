import { Request, Response } from "express";
import {
  borrarSeccion,
  crearSeccion,
  editarSeccion,
  listarSecciones,
  obtenerResumenHoy,
  obtenerSeccion,
  listarResponsablesTramo,
  listarTrabajadoresResponsables,
  asignarResponsableTramo,
  retirarResponsableTramo,
} from "../services/seccion.service";

export async function hoy(req: Request, res: Response): Promise<void> {
  const resumen = await obtenerResumenHoy(req.user!.usuarioId, req.user!.rol, req.params.id as string);
  res.json(resumen);
}

export async function crear(req: Request, res: Response): Promise<void> {
  const seccion = await crearSeccion(req.user!.usuarioId, req.body);
  res.status(201).json({ seccion });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const secciones = await listarSecciones();
  res.json({ secciones });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const seccion = await obtenerSeccion(req.params.id as string);
  res.json({ seccion });
}

export async function responsables(req: Request, res: Response): Promise<void> {
  const responsablesTramo = await listarResponsablesTramo(req.params.id as string);
  res.json({ responsablesTramo });
}

export async function trabajadoresResponsables(_req: Request, res: Response): Promise<void> {
  const trabajadores = await listarTrabajadoresResponsables();
  res.json({ trabajadores });
}

export async function asignarResponsable(req: Request, res: Response): Promise<void> {
  const responsable = await asignarResponsableTramo(req.user!.usuarioId, req.params.id as string, req.body.trabajadorId);
  res.status(201).json({ responsable });
}

export async function retirarResponsable(req: Request, res: Response): Promise<void> {
  await retirarResponsableTramo(req.user!.usuarioId, req.params.id as string, req.params.trabajadorId as string);
  res.status(204).send();
}

export async function editar(req: Request, res: Response): Promise<void> {
  const seccion = await editarSeccion(req.user!.usuarioId, req.params.id as string, req.body);
  res.json({ seccion });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarSeccion(req.user!.usuarioId, req.params.id as string);
  res.status(204).send();
}

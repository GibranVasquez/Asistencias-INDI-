import { Request, Response } from "express";
import {
  aplicarSueldoATodosDeCategoria,
  borrarCategoriaTrabajador,
  crearCategoriaTrabajador,
  editarCategoriaTrabajador,
  listarCategoriasTrabajador,
  obtenerCategoriaTrabajador,
} from "../services/categoriaTrabajador.service";

export async function crear(req: Request, res: Response): Promise<void> {
  const categoria = await crearCategoriaTrabajador(req.user!.usuarioId, req.body);
  res.status(201).json({ categoria });
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const categorias = await listarCategoriasTrabajador();
  res.json({ categorias });
}

export async function obtener(req: Request, res: Response): Promise<void> {
  const categoria = await obtenerCategoriaTrabajador(req.params.id as string);
  res.json({ categoria });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const categoria = await editarCategoriaTrabajador(req.user!.usuarioId, req.params.id as string, req.body);
  res.json({ categoria });
}

export async function borrar(req: Request, res: Response): Promise<void> {
  await borrarCategoriaTrabajador(req.user!.usuarioId, req.params.id as string);
  res.status(204).send();
}

export async function aplicarATodos(req: Request, res: Response): Promise<void> {
  const resultado = await aplicarSueldoATodosDeCategoria(
    req.user!.usuarioId,
    req.params.id as string,
    req.body.nuevoSueldoBase
  );
  res.json(resultado);
}

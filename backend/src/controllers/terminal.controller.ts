import { Request, Response } from "express";
import { crearTerminal, editarTerminal, listarTerminales } from "../services/terminal.service";
import { sincronizarMarcacionesTerminal, MarcacionTerminalNormalizada } from "../services/sincronizacionTerminal.service";

export async function listar(_req: Request, res: Response): Promise<void> {
  const terminales = await listarTerminales();
  res.json({ terminales });
}

export async function crear(req: Request, res: Response): Promise<void> {
  const terminal = await crearTerminal(req.user!.usuarioId, req.body);
  res.status(201).json({ terminal });
}

export async function editar(req: Request, res: Response): Promise<void> {
  const terminal = await editarTerminal(req.user!.usuarioId, req.params.id as string, req.body);
  res.json({ terminal });
}

export async function sincronizar(req: Request, res: Response): Promise<void> {
  const resultado = await sincronizarMarcacionesTerminal(req.params.id as string, req.body.marcaciones as MarcacionTerminalNormalizada[]);
  res.json(resultado);
}

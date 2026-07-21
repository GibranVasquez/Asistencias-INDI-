import { Request, Response } from "express";
import { iniciarSesionTerminal } from "../services/terminalAuth.service";

export async function loginTerminal(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const resultado = await iniciarSesionTerminal(username, password);
  res.json(resultado);
}

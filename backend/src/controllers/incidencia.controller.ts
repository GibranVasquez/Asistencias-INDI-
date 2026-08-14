import { Request, Response } from "express";
import { listarIncidencias } from "../services/incidencia.service";

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarIncidencias({
    busqueda: req.query.busqueda as string | undefined,
    desde: req.query.desde ? new Date(String(req.query.desde)) : undefined,
    hasta: req.query.hasta ? new Date(String(req.query.hasta)) : undefined,
    pagina: Number(req.query.pagina ?? 1), limite: Number(req.query.limite ?? 25),
  }));
}

import { Request, Response } from "express";
import { listarIncidencias } from "../services/incidencia.service";
import { reconciliarEventoAdms } from "../services/reconciliacion.service";

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await listarIncidencias({
    busqueda: req.query.busqueda as string | undefined,
    desde: req.query.desde ? new Date(String(req.query.desde)) : undefined,
    hasta: req.query.hasta ? new Date(String(req.query.hasta)) : undefined,
    pagina: Number(req.query.pagina ?? 1), limite: Number(req.query.limite ?? 25),
  }));
}

export async function reconciliar(req: Request, res: Response): Promise<void> {
  const trabajadorId = req.body?.trabajadorId;
  const seccionId = req.body?.seccionId;
  if (typeof trabajadorId !== "string" || typeof seccionId !== "string") {
    res.status(400).json({ error: "trabajadorId y seccionId son requeridos." });
    return;
  }
  const resultado = await reconciliarEventoAdms(req.user!.usuarioId, String(req.params.id), { trabajadorId, seccionId });
  res.json(resultado);
}

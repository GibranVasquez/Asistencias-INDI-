import { Request, Response } from "express";
import { listarAuditoria } from "../services/auditoria.service";

export async function listar(req: Request, res: Response): Promise<void> {
  const resultado = await listarAuditoria({
    entidad: req.query.entidad as string | undefined,
    entidadId: req.query.entidadId as string | undefined,
    accion: req.query.accion as string | undefined,
    actor: req.query.actor as string | undefined,
    desde: req.query.desde ? new Date(String(req.query.desde)) : undefined,
    hasta: req.query.hasta ? new Date(String(req.query.hasta)) : undefined,
    pagina: Number(req.query.pagina ?? 1),
    limite: Number(req.query.limite ?? 25),
  });
  res.json(resultado);
}

import { Request, Response } from "express";
import { listarAuditoria } from "../services/auditoria.service";

export async function listar(req: Request, res: Response): Promise<void> {
  const entidad = req.query.entidad as string | undefined;
  const entidadId = req.query.entidadId as string | undefined;
  const registros = await listarAuditoria({ entidad, entidadId });
  res.json({ registros });
}

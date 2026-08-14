import { NextFunction, Request, Response } from "express";
import { esUUID } from "../utils/validacion";

export function validarFiltroAuditoria(req: Request, res: Response, next: NextFunction): void {
  const { entidad, entidadId, accion, actor, desde, hasta } = req.query;

  if (entidad !== undefined && typeof entidad !== "string") {
    res.status(400).json({ error: "entidad debe ser un texto si se envía." });
    return;
  }

  if (entidadId !== undefined && !esUUID(entidadId)) {
    res.status(400).json({ error: "entidadId debe ser un UUID válido si se envía." });
    return;
  }
  for (const [nombre, valor] of [["accion", accion], ["actor", actor]] as const) {
    if (valor !== undefined && (typeof valor !== "string" || valor.length > 80)) {
      res.status(400).json({ error: `${nombre} debe ser un texto de hasta 80 caracteres.` }); return;
    }
  }
  for (const [nombre, valor] of [["desde", desde], ["hasta", hasta]] as const) {
    if (valor !== undefined && (typeof valor !== "string" || Number.isNaN(Date.parse(valor)))) {
      res.status(400).json({ error: `${nombre} debe ser una fecha válida.` }); return;
    }
  }
  const pagina = Number(req.query.pagina ?? 1);
  const limite = Number(req.query.limite ?? 25);
  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(limite) || limite < 1 || limite > 50) {
    res.status(400).json({ error: "pagina debe ser positiva y limite debe estar entre 1 y 50." }); return;
  }

  next();
}

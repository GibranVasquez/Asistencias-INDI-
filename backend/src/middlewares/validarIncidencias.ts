import { NextFunction, Request, Response } from "express";

export function validarFiltroIncidencias(req: Request, res: Response, next: NextFunction): void {
  const busqueda = req.query.busqueda;
  if (busqueda !== undefined && (typeof busqueda !== "string" || busqueda.length > 80)) {
    res.status(400).json({ error: "busqueda debe ser un texto de hasta 80 caracteres." }); return;
  }
  for (const nombre of ["desde", "hasta"] as const) {
    const valor = req.query[nombre];
    if (valor !== undefined && (typeof valor !== "string" || Number.isNaN(Date.parse(valor)))) {
      res.status(400).json({ error: `${nombre} debe ser una fecha válida.` }); return;
    }
  }
  const pagina = Number(req.query.pagina ?? 1); const limite = Number(req.query.limite ?? 25);
  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(limite) || limite < 1 || limite > 50) {
    res.status(400).json({ error: "pagina debe ser positiva y limite debe estar entre 1 y 50." }); return;
  }
  next();
}

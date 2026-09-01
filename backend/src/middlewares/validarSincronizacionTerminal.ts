import { NextFunction, Request, Response } from "express";
import { esStringNoVacia, esUUID } from "../utils/validacion";
import { TipoMarcacion } from "@prisma/client";

const MAX_MARCACIONES = 500;
const CAMPOS_PERMITIDOS = new Set(["trabajadorExternoId", "fechaHoraLocal", "tipoMarcacion", "codigoCrudo", "metodoVerificacion", "terminalSerial", "eventoOrigenId", "metadata"]);

export function validarSincronizacionTerminal(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  if (!Array.isArray(body.marcaciones)) {
    res.status(400).json({ error: "marcaciones debe ser un arreglo." }); return;
  }
  if (body.marcaciones.length > MAX_MARCACIONES) {
    res.status(400).json({ error: `El lote no puede superar ${MAX_MARCACIONES} marcaciones.` }); return;
  }
  for (const [indice, marca] of body.marcaciones.entries()) {
    if (!marca || typeof marca !== "object" || Array.isArray(marca)) { res.status(400).json({ error: `Marcación ${indice} inválida.` }); return; }
    const claves = Object.keys(marca as object);
    if (claves.some((clave) => !CAMPOS_PERMITIDOS.has(clave))) { res.status(400).json({ error: `Marcación ${indice} contiene campos no permitidos.` }); return; }
    const m = marca as Record<string, unknown>;
    if (!esStringNoVacia(m.trabajadorExternoId, 100) || !esStringNoVacia(m.fechaHoraLocal, 40) || !esStringNoVacia(m.terminalSerial, 200)) { res.status(400).json({ error: `Marcación ${indice} requiere trabajadorExternoId, fechaHoraLocal y terminalSerial.` }); return; }
    if (m.tipoMarcacion !== null && m.tipoMarcacion !== undefined && (!Object.values(TipoMarcacion).includes(m.tipoMarcacion as TipoMarcacion))) { res.status(400).json({ error: `tipoMarcacion inválido en marcación ${indice}.` }); return; }
    if (m.codigoCrudo !== null && m.codigoCrudo !== undefined && (!Number.isInteger(m.codigoCrudo) || (m.codigoCrudo as number) < -2147483648 || (m.codigoCrudo as number) > 2147483647)) { res.status(400).json({ error: `codigoCrudo inválido en marcación ${indice}.` }); return; }
    if (m.eventoOrigenId !== null && m.eventoOrigenId !== undefined && !esUUID(m.eventoOrigenId)) { res.status(400).json({ error: `eventoOrigenId inválido en marcación ${indice}.` }); return; }
    if (m.metadata !== undefined && (typeof m.metadata !== "object" || m.metadata === null || Array.isArray(m.metadata))) { res.status(400).json({ error: `metadata inválida en marcación ${indice}.` }); return; }
  }
  next();
}

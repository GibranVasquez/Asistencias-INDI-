import { NextFunction, Request, Response } from "express";
import { MetodoAsistencia } from "@prisma/client";
import { esFechaISO, esHora, esStringNoVacia, esUUID } from "../utils/validacion";

const LONGITUD_MAXIMA_TURNO = 50;
const LONGITUD_MAXIMA_UBICACION = 200;

function esMetodoAsistencia(valor: unknown): valor is MetodoAsistencia {
  return typeof valor === "string" && Object.values(MetodoAsistencia).includes(valor as MetodoAsistencia);
}

export function validarAsistencia(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  // terminalOrigenId NO se lee del body: lo establece terminalAuthMiddleware
  // a partir del JWT del terminal autenticado, para que el kiosco no pueda
  // reportar asistencia "a nombre de" otro terminal.
  const { trabajadorId, fecha, hora, seccionId, turno, metodoUsado, ubicacionGPS } = body;

  if (!esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esFechaISO(fecha)) {
    res.status(400).json({ error: "fecha es requerida en formato YYYY-MM-DD." });
    return;
  }

  if (!esHora(hora)) {
    res.status(400).json({ error: "hora es requerida en formato HH:MM o HH:MM:SS." });
    return;
  }

  if (!esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId es requerido y debe ser un UUID válido." });
    return;
  }

  if (!esStringNoVacia(turno, LONGITUD_MAXIMA_TURNO)) {
    res.status(400).json({ error: "turno es requerido y debe ser un texto válido." });
    return;
  }

  if (!esMetodoAsistencia(metodoUsado)) {
    res.status(400).json({ error: "metodoUsado es requerido y debe ser 'huella' o 'rostro'." });
    return;
  }

  if (ubicacionGPS !== undefined && ubicacionGPS !== null && !esStringNoVacia(ubicacionGPS, LONGITUD_MAXIMA_UBICACION)) {
    res.status(400).json({ error: "ubicacionGPS debe ser un texto válido si se envía." });
    return;
  }

  next();
}

export function validarFiltroAsistencia(req: Request, res: Response, next: NextFunction): void {
  const { fecha, fechaInicio, fechaFin, seccionId, trabajadorId } = req.query;

  if (fecha !== undefined && !esFechaISO(fecha)) {
    res.status(400).json({ error: "fecha (query) debe ser una fecha válida en formato YYYY-MM-DD." });
    return;
  }
  if (fechaInicio !== undefined && !esFechaISO(fechaInicio)) {
    res.status(400).json({ error: "fechaInicio (query) debe ser una fecha válida en formato YYYY-MM-DD." });
    return;
  }
  if (fechaFin !== undefined && !esFechaISO(fechaFin)) {
    res.status(400).json({ error: "fechaFin (query) debe ser una fecha válida en formato YYYY-MM-DD." });
    return;
  }
  if (esFechaISO(fechaInicio) && esFechaISO(fechaFin) && Date.parse(fechaFin) < Date.parse(fechaInicio)) {
    res.status(400).json({ error: "fechaFin no puede ser anterior a fechaInicio." });
    return;
  }
  if (seccionId !== undefined && !esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId (query) debe ser un UUID válido si se envía." });
    return;
  }
  if (trabajadorId !== undefined && !esUUID(trabajadorId)) {
    res.status(400).json({ error: "trabajadorId (query) debe ser un UUID válido si se envía." });
    return;
  }
  for (const [nombre, valor] of [["turno", req.query.turno], ["categoria", req.query.categoria]] as const) {
    if (valor !== undefined && (typeof valor !== "string" || valor.length === 0 || valor.length > 150)) {
      res.status(400).json({ error: `${nombre} debe ser un texto válido si se envía.` });
      return;
    }
  }

  next();
}

export function validarExportarListaSemanal(req: Request, res: Response, next: NextFunction): void {
  const { fechaInicio, fechaFin, seccionId, formato, turno, categoria } = req.query;
  if (!esFechaISO(fechaInicio) || !esFechaISO(fechaFin)) {
    res.status(400).json({ error: "fechaInicio y fechaFin son requeridas en formato YYYY-MM-DD." });
    return;
  }
  if (Date.parse(fechaFin as string) < Date.parse(fechaInicio as string)) {
    res.status(400).json({ error: "fechaFin no puede ser anterior a fechaInicio." });
    return;
  }
  if (seccionId !== undefined && !esUUID(seccionId)) {
    res.status(400).json({ error: "seccionId debe ser un UUID válido si se envía." });
    return;
  }
  if (formato !== "pdf" && formato !== "excel") {
    res.status(400).json({ error: "formato debe ser 'pdf' o 'excel'." });
    return;
  }
  for (const [nombre, valor] of [["turno", turno], ["categoria", categoria]] as const) {
    if (valor !== undefined && (typeof valor !== "string" || valor.length === 0 || valor.length > 150)) {
      res.status(400).json({ error: `${nombre} debe ser un texto válido si se envía.` });
      return;
    }
  }
  next();
}

import { Request, Response } from "express";
import {
  listarAsistencias,
  obtenerAsistenciaMasRecienteDeTerminal,
  registrarAsistencia,
} from "../services/asistencia.service";

export async function registrar(req: Request, res: Response): Promise<void> {
  const { trabajadorId, ...datos } = req.body;
  const terminalOrigenId = req.terminal!.terminalId;

  const asistencia = await registrarAsistencia(trabajadorId, terminalOrigenId, datos);
  res.status(201).json({ asistencia });
}

export async function reciente(_req: Request, res: Response): Promise<void> {
  const asistencia = await obtenerAsistenciaMasRecienteDeTerminal();
  res.json({ asistencia });
}

export async function listar(req: Request, res: Response): Promise<void> {
  const { fecha, fechaInicio, fechaFin, seccionId, trabajadorId } = req.query;
  const asistencias = await listarAsistencias(req.user!.usuarioId, req.user!.rol, {
    fecha: fecha as string | undefined,
    fechaInicio: fechaInicio as string | undefined,
    fechaFin: fechaFin as string | undefined,
    seccionId: seccionId as string | undefined,
    trabajadorId: trabajadorId as string | undefined,
  });
  res.json({ asistencias });
}

import { Request, Response } from "express";
import {
  listarAsistencias,
  obtenerAsistenciaMasRecienteDeTerminal,
  registrarAsistencia,
} from "../services/asistencia.service";
import { generarExcelListaSemanal, generarPdfListaSemanal } from "../utils/exportadores/listaSemanalExport";
import { obtenerObraActual } from "../services/obra.service";

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
  const { fecha, fechaInicio, fechaFin, seccionId, trabajadorId, turno, categoria } = req.query;
  const asistencias = await listarAsistencias(req.user!.usuarioId, req.user!.rol, {
    fecha: fecha as string | undefined,
    fechaInicio: fechaInicio as string | undefined,
    fechaFin: fechaFin as string | undefined,
    seccionId: seccionId as string | undefined,
    trabajadorId: trabajadorId as string | undefined,
    turno: turno as string | undefined,
    categoria: categoria as string | undefined,
  });
  res.json({ asistencias });
}

export async function exportarListaSemanal(req: Request, res: Response): Promise<void> {
  const { fechaInicio, fechaFin, seccionId, turno, categoria, formato } = req.query;
  const [asistencias, obra] = await Promise.all([
    listarAsistencias(req.user!.usuarioId, req.user!.rol, {
    fechaInicio: fechaInicio as string,
    fechaFin: fechaFin as string,
    seccionId: seccionId as string | undefined,
    turno: turno as string | undefined,
    categoria: categoria as string | undefined,
    }),
    obtenerObraActual(),
  ]);
  const contexto = {
    area: obra.nombre,
    frente: seccionId ? asistencias[0]?.seccionNombre ?? "No especificado" : "Todos los frentes",
    tramoUbicacion: seccionId ? asistencias[0]?.seccionTramoUbicacion ?? "No especificado" : "No especificado",
    responsableTramo: seccionId ? asistencias[0]?.seccionResponsables.map((r) => r.username).join(", ") || "No asignado" : "No asignado",
    categoria: typeof categoria === "string" ? categoria : "Todas las categorías",
    turno: typeof turno === "string" ? turno : ([...new Set(asistencias.map((a) => a.turno))].join(", ") || "No especificado"),
    semana: String(numeroSemana(new Date(`${fechaInicio}T00:00:00Z`))),
    fechaInicio: fechaInicio as string,
    fechaFin: fechaFin as string,
  };
  const nombreBase = `Lista_Asistencia_Semana_${String(fechaInicio).replaceAll("-", "")}`;
  if (formato === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreBase}.pdf"`);
    generarPdfListaSemanal({ contexto, asistencias }, res);
    return;
  }
  const buffer = await generarExcelListaSemanal({ contexto, asistencias });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreBase}.xlsx"`);
  res.send(Buffer.from(buffer));
}

function numeroSemana(fecha: Date): number {
  const inicio = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const dia = inicio.getUTCDay() || 7;
  inicio.setUTCDate(inicio.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(inicio.getUTCFullYear(), 0, 1));
  return Math.ceil((((inicio.getTime() - inicioAnio.getTime()) / 86400000) + 1) / 7);
}

import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import {
  generarRespuestaHandshake,
  procesarLoteAttlog,
  resolverTerminalPorSN,
} from "../services/adms.service";

// Todas las respuestas de este controller son texto plano, nunca JSON: el
// equipo ADMS espera el formato de fábrica del protocolo push de ZKTeco,
// no nuestra API REST habitual (ver CLAUDE.md para el resto del contexto
// de por qué este endpoint vive fuera del router JSON normal).

// GET /iclock/cdata?SN=...&options=all — handshake inicial del equipo.
export async function handshake(req: Request, res: Response): Promise<void> {
  const sn = req.query.SN as string | undefined;
  const terminal = await resolverTerminalPorSN(sn);

  await prisma.terminal.update({
    where: { id: terminal.id },
    data: { estadoConexion: "conectado", ultimaSincronizacion: new Date() },
  });

  res.type("text/plain").send(generarRespuestaHandshake(sn!));
}

// POST /iclock/cdata?SN=...&table=ATTLOG|OPERLOG&Stamp=... — el equipo
// empuja registros nuevos. req.body ya viene como texto crudo (ver
// adms.routes.ts, que usa express.text() en vez del express.json()
// global de app.ts).
export async function subirDatos(req: Request, res: Response): Promise<void> {
  const sn = req.query.SN as string | undefined;
  const tabla = req.query.table as string | undefined;
  const terminal = await resolverTerminalPorSN(sn);
  const cuerpo = typeof req.body === "string" ? req.body : "";

  await prisma.terminal.update({
    where: { id: terminal.id },
    data: { ultimaSincronizacion: new Date() },
  });

  if (tabla === "ATTLOG") {
    const resultado = await procesarLoteAttlog(terminal, cuerpo);
    console.log(
      `[adms] ATTLOG terminal=${terminal.id}: ${resultado.procesados} procesados, ${resultado.duplicados} duplicados, ${resultado.noReconciliados} no reconciliados`
    );
  } else if (tabla === "OPERLOG") {
    // Fuera de alcance de la Tarea 1 (registros de operacion del equipo —
    // altas/bajas de usuario, cambios de huella, etc. hechos EN el
    // dispositivo) — se reconoce para que el equipo no reintente el lote
    // en loop, pero no se procesa el contenido todavia.
    console.log(`[adms] OPERLOG recibido de terminal=${terminal.id} (no procesado, fuera de alcance)`);
  }

  res.type("text/plain").send("OK");
}

// GET /iclock/getrequest?SN=... — el equipo pregunta si hay comandos
// pendientes. Nunca le mandamos comandos (no hace falta para recibir
// asistencia), así que siempre "no hay nada".
export async function getrequest(req: Request, res: Response): Promise<void> {
  const sn = req.query.SN as string | undefined;
  await resolverTerminalPorSN(sn);
  res.type("text/plain").send("OK");
}

// POST /iclock/devicecmd — el equipo confirma la ejecución de un comando
// que nunca le mandamos. No debería llamarse en la práctica, pero se
// responde igual para no dejar al equipo esperando.
export async function devicecmd(req: Request, res: Response): Promise<void> {
  await resolverTerminalPorSN(req.query.SN as string | undefined);
  res.type("text/plain").send("OK");
}

// GET/POST /iclock/registry — algunos firmwares lo llaman al conectar por
// primera vez con sus capacidades (modelo, versión, etc.). No se persiste
// nada de esto todavía; se reconoce para no bloquear el resto del handshake.
export async function registry(req: Request, res: Response): Promise<void> {
  await resolverTerminalPorSN(req.query.SN as string | undefined);
  res.type("text/plain").send("OK");
}

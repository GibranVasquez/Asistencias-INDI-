import { Prisma, TipoMarcacion, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { registrarAsistencia } from "./asistencia.service";

export interface MarcacionTerminalNormalizada {
  trabajadorExternoId: string;
  fechaHoraLocal: string;
  tipoMarcacion: TipoMarcacion | null;
  codigoCrudo: number | null;
  metodoVerificacion: string | null;
  terminalSerial: string;
  eventoOrigenId: string | null;
  metadata?: { status?: number | null };
}

export interface ResultadoSincronizacion {
  recibidas: number; nuevas: number; duplicadas: number; errores: number;
  detallesErrores: { indice: number; trabajadorExternoId: string; codigo: string; mensaje: string }[];
}

function parsearFechaHora(valor: string): { fecha: string; hora: string; timestamp: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "00"] = m;
  const fecha = `${y}-${mo}-${d}`; const hora = `${h}:${mi}:${s}`;
  const timestamp = new Date(`${fecha}T${hora}Z`);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString().slice(0, 19) !== `${fecha}T${hora}`) return null;
  return { fecha, hora, timestamp };
}

function metodoCompatible(valor: string | null): "huella" | "rostro" {
  return valor === "rostro" || valor === "15" ? "rostro" : "huella";
}

export async function sincronizarMarcacionesTerminal(terminalId: string, marcaciones: MarcacionTerminalNormalizada[]): Promise<ResultadoSincronizacion> {
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalId }, select: { id: true, activo: true, numeroSerie: true, obraId: true } });
  if (!terminal || !terminal.activo) throw new AppError(403, "La terminal no está autorizada.");
  if (!terminal.obraId) throw new AppError(403, "La terminal no tiene una Obra asignada.");
  const resultado: ResultadoSincronizacion = { recibidas: marcaciones.length, nuevas: 0, duplicadas: 0, errores: 0, detallesErrores: [] };
  for (const [indice, marca] of marcaciones.entries()) {
    const fallo = (codigo: string, mensaje: string) => { resultado.errores++; resultado.detallesErrores.push({ indice, trabajadorExternoId: marca.trabajadorExternoId, codigo, mensaje }); };
    if (terminal.numeroSerie && marca.terminalSerial !== terminal.numeroSerie) { fallo("SERIAL_NO_COINCIDE", "El serial de la marcación no corresponde a la terminal."); continue; }
    const civil = parsearFechaHora(marca.fechaHoraLocal);
    if (!civil) { fallo("FECHA_HORA_INVALIDA", "fechaHoraLocal debe usar YYYY-MM-DDTHH:MM[:SS]."); continue; }
    const numero = Number(marca.trabajadorExternoId);
    const trabajador = Number.isInteger(numero) ? await prisma.trabajador.findUnique({ where: { numeroChecador: numero } }) : null;
    if (!trabajador) { fallo("TRABAJADOR_NO_ENCONTRADO", "No existe un trabajador con ese identificador."); continue; }
    if (trabajador.estatus !== TrabajadorEstatus.activo) { fallo("TRABAJADOR_INACTIVO", "El trabajador no está activo."); continue; }
    const existente = await prisma.asistenciaDiaria.findFirst({ where: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, fecha: new Date(`${civil.fecha}T00:00:00.000Z`), hora: new Date(`1970-01-01T${civil.hora}Z`) }, select: { id: true } });
    if (existente) { resultado.duplicadas++; continue; }
    const asignacion = await prisma.asignacionDiaria.findUnique({ where: { trabajadorId_fecha: { trabajadorId: trabajador.id, fecha: new Date(`${civil.fecha}T00:00:00.000Z`) } }, include: { seccion: { select: { id: true, obraId: true } } } });
    if (asignacion && asignacion.seccion.obraId !== terminal.obraId) { fallo("ASIGNACION_OBRA_INCOMPATIBLE", "La asignación pertenece a otra Obra."); continue; }
    try {
      await registrarAsistencia(trabajador.id, terminal.id, { fecha: civil.fecha, hora: civil.hora, obraId: terminal.obraId, seccionId: asignacion?.seccion.id ?? null, turno: "Oficina", metodoUsado: metodoCompatible(marca.metodoVerificacion), tipoMarcacion: marca.tipoMarcacion, punchCrudo: marca.codigoCrudo });
      resultado.nuevas++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") resultado.duplicadas++;
      else fallo("ERROR_INGESTA", error instanceof Error ? error.message : "No se pudo registrar la marcación.");
    }
  }
  if (resultado.nuevas > 0 || resultado.duplicadas > 0) {
    await prisma.terminal.update({ where: { id: terminal.id }, data: { ultimaSincronizacion: new Date(), estadoConexion: "conectado" } });
  }
  return resultado;
}

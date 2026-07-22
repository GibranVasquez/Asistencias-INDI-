import { Horario } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosHorario {
  nombre: string;
  horaEntrada: string; // HH:MM o HH:MM:SS
  horaSalida: string;
  toleranciaMinutos: number;
  recesoInicio?: string | null;
  recesoFin?: string | null;
}

function aHoraUTC(hora: string): Date {
  const normalizada = hora.length === 5 ? `${hora}:00` : hora;
  return new Date(`1970-01-01T${normalizada}Z`);
}

function datosParaPrisma(datos: DatosHorario) {
  return {
    nombre: datos.nombre,
    horaEntrada: aHoraUTC(datos.horaEntrada),
    horaSalida: aHoraUTC(datos.horaSalida),
    toleranciaMinutos: datos.toleranciaMinutos,
    recesoInicio: datos.recesoInicio ? aHoraUTC(datos.recesoInicio) : null,
    recesoFin: datos.recesoFin ? aHoraUTC(datos.recesoFin) : null,
  };
}

export async function crearHorario(datos: DatosHorario): Promise<Horario> {
  const existente = await prisma.horario.findUnique({ where: { nombre: datos.nombre } });
  if (existente) {
    throw new AppError(409, "Ya existe un horario con ese nombre.");
  }

  return prisma.horario.create({ data: datosParaPrisma(datos) });
}

export interface HorarioConSecciones extends Horario {
  secciones: { id: string; nombre: string }[];
}

// Incluye qué secciones usan cada horario para que RH vea el impacto antes
// de editar/borrar uno (el mismo dato que borrarHorario usa para decidir
// si rechaza el borrado).
export async function listarHorarios(): Promise<HorarioConSecciones[]> {
  return prisma.horario.findMany({
    orderBy: { nombre: "asc" },
    include: { secciones: { select: { id: true, nombre: true } } },
  });
}

export async function obtenerHorario(id: string): Promise<Horario> {
  const horario = await prisma.horario.findUnique({ where: { id } });
  if (!horario) {
    throw new AppError(404, "Horario no encontrado.");
  }
  return horario;
}

export async function editarHorario(id: string, datos: DatosHorario): Promise<Horario> {
  await obtenerHorario(id);

  const conflicto = await prisma.horario.findUnique({ where: { nombre: datos.nombre } });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe un horario con ese nombre.");
  }

  return prisma.horario.update({ where: { id }, data: datosParaPrisma(datos) });
}

export async function borrarHorario(id: string): Promise<void> {
  await obtenerHorario(id);

  // Seccion.horarioId tiene ON DELETE SET NULL: sin este guardrail, borrar
  // un horario en uso no truena, sino que desasigna en silencio el horario
  // de esas secciones.
  const enUso = await prisma.seccion.count({ where: { horarioId: id } });
  if (enUso > 0) {
    throw new AppError(409, "No se puede borrar: hay secciones que usan este horario.");
  }

  await prisma.horario.delete({ where: { id } });
}

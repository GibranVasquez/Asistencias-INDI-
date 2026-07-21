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

export async function listarHorarios(): Promise<Horario[]> {
  return prisma.horario.findMany({ orderBy: { nombre: "asc" } });
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
  // Horario no tiene ninguna relación en el schema todavía (catálogo aún no
  // referenciado desde Trabajador/AsistenciaDiaria) — no hay "en uso" que validar.
  await prisma.horario.delete({ where: { id } });
}

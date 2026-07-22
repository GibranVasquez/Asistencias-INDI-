import { RolUsuario, Seccion } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { verificarAccesoSeccion } from "../utils/accesoSeccion";

export interface DatosAltaSeccion {
  obraId: string;
  nombre: string;
  horarioId?: string | null;
}

export interface DatosEdicionSeccion {
  nombre: string;
  // undefined = no tocar el horario actual; null = quitarlo; string = asignar ese.
  horarioId?: string | null;
}

interface TrabajadorResumen {
  trabajadorId: string;
  nombreCompleto: string;
}

export interface ResumenSeccionHoy {
  fecha: string;
  seccionId: string;
  // asignado=false cuando la marcacion real no coincide con el plan del dia
  // (no esta asignado hoy a esta seccion, o esta asignado a otra) — la
  // asistencia real nunca se oculta solo porque no cuadra con la asignacion.
  presentes: (TrabajadorResumen & { hora: string; asignado: boolean })[];
  sinAsignacion: boolean;
  totalAsignado: number | null;
  ausentes: TrabajadorResumen[] | null;
}

// "Hoy" segun la hora LOCAL del servidor, no UTC — el resto del sistema
// (POST /asignaciones, GET /asignaciones/sugerencia, el kiosco) ya trabaja
// con la fecha local que manda el frontend; usar UTC aqui hacia que este
// endpoint "saltara" al dia siguiente ~5-6 horas antes que el resto del
// sistema (Mexico esta detras de UTC), rompiendo la vista de hoy durante
// esas horas. Requiere que el servidor corra con TZ configurada a la
// zona horaria real de la obra (America/Mexico_City o equivalente).
function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

async function verificarHorarioExiste(horarioId: string | null | undefined): Promise<void> {
  if (!horarioId) return;
  const horario = await prisma.horario.findUnique({ where: { id: horarioId } });
  if (!horario) {
    throw new AppError(404, "El horario indicado no existe.");
  }
}

export async function crearSeccion(datos: DatosAltaSeccion): Promise<Seccion> {
  const obra = await prisma.obra.findUnique({ where: { id: datos.obraId } });
  if (!obra) {
    throw new AppError(404, "La obra indicada no existe.");
  }

  const existente = await prisma.seccion.findUnique({
    where: { obraId_nombre: { obraId: datos.obraId, nombre: datos.nombre } },
  });
  if (existente) {
    throw new AppError(409, "Ya existe una sección con ese nombre en esa obra.");
  }

  await verificarHorarioExiste(datos.horarioId);

  return prisma.seccion.create({
    data: { obraId: datos.obraId, nombre: datos.nombre, horarioId: datos.horarioId ?? null },
  });
}

export async function listarSecciones(): Promise<Seccion[]> {
  return prisma.seccion.findMany({ orderBy: { nombre: "asc" } });
}

export async function obtenerSeccion(id: string): Promise<Seccion> {
  const seccion = await prisma.seccion.findUnique({ where: { id } });
  if (!seccion) {
    throw new AppError(404, "Sección no encontrada.");
  }
  return seccion;
}

export async function editarSeccion(id: string, datos: DatosEdicionSeccion): Promise<Seccion> {
  const seccion = await obtenerSeccion(id);

  const conflicto = await prisma.seccion.findUnique({
    where: { obraId_nombre: { obraId: seccion.obraId, nombre: datos.nombre } },
  });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe una sección con ese nombre en esa obra.");
  }

  await verificarHorarioExiste(datos.horarioId);

  return prisma.seccion.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      horarioId: datos.horarioId === undefined ? undefined : datos.horarioId,
    },
  });
}

export async function obtenerResumenHoy(
  usuarioId: string,
  rol: RolUsuario,
  seccionId: string
): Promise<ResumenSeccionHoy> {
  await verificarAccesoSeccion(usuarioId, rol, seccionId);
  await obtenerSeccion(seccionId);

  const fecha = hoyUTC();

  const [asistenciasHoy, asignacionesHoy] = await Promise.all([
    prisma.asistenciaDiaria.findMany({
      where: { seccionId, fecha },
      include: { trabajador: { select: { id: true, nombreCompleto: true } } },
      orderBy: { hora: "asc" },
    }),
    prisma.asignacionDiaria.findMany({
      where: { seccionId, fecha },
      include: { trabajador: { select: { id: true, nombreCompleto: true } } },
    }),
  ]);

  const idsAsignadosEstaSeccion = new Set(asignacionesHoy.map((a) => a.trabajadorId));

  const presentes = asistenciasHoy.map((a) => ({
    trabajadorId: a.trabajador.id,
    nombreCompleto: a.trabajador.nombreCompleto,
    hora: a.hora.toISOString().slice(11, 19),
    asignado: idsAsignadosEstaSeccion.has(a.trabajador.id),
  }));

  if (asignacionesHoy.length === 0) {
    return {
      fecha: fecha.toISOString().slice(0, 10),
      seccionId,
      presentes,
      sinAsignacion: true,
      totalAsignado: null,
      ausentes: null,
    };
  }

  const idsPresentes = new Set(presentes.map((p) => p.trabajadorId));
  const ausentes = asignacionesHoy
    .filter((asignacion) => !idsPresentes.has(asignacion.trabajadorId))
    .map((asignacion) => ({
      trabajadorId: asignacion.trabajador.id,
      nombreCompleto: asignacion.trabajador.nombreCompleto,
    }));

  return {
    fecha: fecha.toISOString().slice(0, 10),
    seccionId,
    presentes,
    sinAsignacion: false,
    totalAsignado: asignacionesHoy.length,
    ausentes,
  };
}

export async function borrarSeccion(id: string): Promise<void> {
  await obtenerSeccion(id);

  const [enUsoAsistencias, encargadosAsignados] = await Promise.all([
    prisma.asistenciaDiaria.count({ where: { seccionId: id } }),
    prisma.usuario.count({ where: { seccionesAsignadas: { some: { id } } } }),
  ]);

  if (enUsoAsistencias > 0 || encargadosAsignados > 0) {
    throw new AppError(409, "No se puede borrar: la sección está en uso (tiene asistencias o encargados asignados).");
  }

  await prisma.seccion.delete({ where: { id } });
}

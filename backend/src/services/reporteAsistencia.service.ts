import { TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import {
  aClaveDia,
  bucketsDelRango,
  calcularResumen,
  diasHabilesEnRango,
  granularidadPara,
  etiquetaBucket,
  llegoATiempo,
  type AsistenciaCruda,
  type MapaHorarios,
  type ResumenAsistencia,
} from "./analiticaAsistencia";

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

export type { ResumenAsistencia } from "./analiticaAsistencia";

export interface FilaSeccionAsistencia {
  seccionId: string;
  seccionNombre: string;
  presentes: number;
  aTiempo: number;
  tardanzas: number;
  porcentajePuntualidad: number | null;
}

export interface FilaTendenciaAsistencia extends ResumenAsistencia {
  etiqueta: string;
  periodoInicio: string;
  periodoFin: string;
}

export interface ReporteAsistencia {
  desde: string;
  hasta: string;
  resumen: ResumenAsistencia;
  porSeccion: FilaSeccionAsistencia[];
  tendencia: FilaTendenciaAsistencia[];
}

async function cargarMapaHorarios(): Promise<MapaHorarios> {
  const [secciones, horarios] = await Promise.all([
    prisma.seccion.findMany({ select: { id: true, horarioId: true } }),
    prisma.horario.findMany({ select: { id: true, horaEntrada: true, toleranciaMinutos: true } }),
  ]);
  const horarioPorId = new Map(horarios.map((h) => [h.id, h]));
  const seccionHorario = new Map(
    secciones.map((s) => [s.id, s.horarioId ? horarioPorId.get(s.horarioId) ?? null : null])
  );
  return { seccionHorario };
}

export async function obtenerReporteAsistencia(
  desdeISO: string,
  hastaISO: string,
  seccionId?: string
): Promise<ReporteAsistencia> {
  const desde = aFechaUTC(desdeISO);
  const hasta = aFechaUTC(hastaISO);
  if (hasta.getTime() < desde.getTime()) {
    throw new AppError(400, "hasta no puede ser anterior a desde.");
  }

  const [asistencias, mapas, totalActivos, secciones] = await Promise.all([
    prisma.asistenciaDiaria.findMany({
      where: { fecha: { gte: desde, lte: hasta }, ...(seccionId ? { seccionId } : {}) },
      select: { fecha: true, hora: true, seccionId: true, trabajadorId: true },
    }),
    cargarMapaHorarios(),
    prisma.trabajador.count({ where: { estatus: TrabajadorEstatus.activo } }),
    prisma.seccion.findMany({ select: { id: true, nombre: true } }),
  ]);

  const diasHabiles = diasHabilesEnRango(desde, hasta);
  const resumen = calcularResumen(asistencias, mapas, diasHabiles, totalActivos, !!seccionId);

  const nombrePorSeccion = new Map(secciones.map((s) => [s.id, s.nombre]));
  const porSeccionMap = new Map<string, AsistenciaCruda[]>();
  for (const a of asistencias) {
    if (!porSeccionMap.has(a.seccionId)) porSeccionMap.set(a.seccionId, []);
    porSeccionMap.get(a.seccionId)!.push(a);
  }
  const porSeccion: FilaSeccionAsistencia[] = [...porSeccionMap.entries()]
    .map(([sid, lista]) => {
      const r = calcularResumen(lista, mapas, diasHabiles, totalActivos, true);
      return {
        seccionId: sid,
        seccionNombre: nombrePorSeccion.get(sid) ?? "Sección eliminada",
        presentes: r.presentes,
        aTiempo: r.aTiempo,
        tardanzas: r.tardanzas,
        porcentajePuntualidad: r.porcentajePuntualidad,
      };
    })
    .sort((a, b) => a.seccionNombre.localeCompare(b.seccionNombre));

  const granularidad = granularidadPara(desde, hasta);
  const buckets = bucketsDelRango(desde, hasta, granularidad);
  const tendencia: FilaTendenciaAsistencia[] = buckets.map(({ inicio, fin }) => {
    const enRango = asistencias.filter((a) => a.fecha.getTime() >= inicio.getTime() && a.fecha.getTime() <= fin.getTime());
    const diasHabilesBucket = diasHabiles.filter((d) => d.getTime() >= inicio.getTime() && d.getTime() <= fin.getTime());
    const r = calcularResumen(enRango, mapas, diasHabilesBucket, totalActivos, !!seccionId);
    return {
      ...r,
      etiqueta: etiquetaBucket(inicio, fin, granularidad),
      periodoInicio: aClaveDia(inicio),
      periodoFin: aClaveDia(fin),
    };
  });

  return { desde: desdeISO, hasta: hastaISO, resumen, porSeccion, tendencia };
}

export interface DiaHistoricoTrabajador {
  fecha: string;
  hora: string | null;
  seccionId: string | null;
  seccionNombre: string | null;
  presente: boolean;
  aTiempo: boolean | null;
}

export interface HistoricoTrabajador {
  trabajadorId: string;
  nombreCompleto: string;
  desde: string;
  hasta: string;
  dias: DiaHistoricoTrabajador[];
  resumen: ResumenAsistencia;
}

export async function obtenerHistoricoTrabajador(
  trabajadorId: string,
  desdeISO: string,
  hastaISO: string
): Promise<HistoricoTrabajador> {
  const desde = aFechaUTC(desdeISO);
  const hasta = aFechaUTC(hastaISO);
  if (hasta.getTime() < desde.getTime()) {
    throw new AppError(400, "hasta no puede ser anterior a desde.");
  }

  const trabajador = await prisma.trabajador.findUnique({ where: { id: trabajadorId } });
  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }

  const [asistencias, mapas] = await Promise.all([
    prisma.asistenciaDiaria.findMany({
      where: { trabajadorId, fecha: { gte: desde, lte: hasta } },
      include: { seccion: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: "asc" }, { hora: "asc" }],
    }),
    cargarMapaHorarios(),
  ]);

  // Si hay más de una marca el mismo día, se queda con la más temprana (ver
  // unaMarcaPorDia) — orderBy hora:asc + "primera que llega gana" en el Map.
  const asistenciaPorDia = new Map<string, (typeof asistencias)[number]>();
  for (const a of asistencias) {
    const clave = aClaveDia(a.fecha);
    if (!asistenciaPorDia.has(clave)) asistenciaPorDia.set(clave, a);
  }
  const diasHabiles = diasHabilesEnRango(desde, hasta);

  const dias: DiaHistoricoTrabajador[] = diasHabiles.map((dia) => {
    const clave = aClaveDia(dia);
    const asistencia = asistenciaPorDia.get(clave);
    if (!asistencia) {
      return { fecha: clave, hora: null, seccionId: null, seccionNombre: null, presente: false, aTiempo: null };
    }
    const horario = mapas.seccionHorario.get(asistencia.seccionId);
    return {
      fecha: clave,
      hora: asistencia.hora.toISOString().slice(11, 19),
      seccionId: asistencia.seccionId,
      seccionNombre: asistencia.seccion.nombre,
      presente: true,
      aTiempo: horario ? llegoATiempo(asistencia.hora, horario) : null,
    };
  });

  const crudas: AsistenciaCruda[] = asistencias.map((a) => ({
    fecha: a.fecha,
    hora: a.hora,
    seccionId: a.seccionId,
    trabajadorId,
  }));
  // ausentes aquí sí es significativo (totalActivos=1: este único trabajador).
  const resumen = calcularResumen(crudas, mapas, diasHabiles, 1, false);

  return {
    trabajadorId,
    nombreCompleto: trabajador.nombreCompleto,
    desde: desdeISO,
    hasta: hastaISO,
    dias,
    resumen,
  };
}

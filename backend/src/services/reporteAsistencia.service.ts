import { TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

function aClaveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA_MS);
}

// Días hábiles = lunes a viernes, mismo criterio que ya usa
// asignacion.service.ts ("salta fin de semana") para no inflar "ausentes"
// contando sábados/domingos donde nadie marca porque no se trabaja, no
// porque falten.
function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getUTCDay();
  return dia !== 0 && dia !== 6;
}

function diasHabilesEnRango(inicio: Date, fin: Date): Date[] {
  const dias: Date[] = [];
  for (let t = inicio.getTime(); t <= fin.getTime(); t += UN_DIA_MS) {
    const d = new Date(t);
    if (esDiaHabil(d)) dias.push(d);
  }
  return dias;
}

// Misma regla que llegoATiempo en DashboardPage.tsx (frontend): la hora
// marcada vs. horaEntrada + toleranciaMinutos del Horario de la Sección
// donde se marcó esa asistencia — replicada aquí para que el reporte no
// dependa de traer registros crudos al cliente para calcularlo.
function llegoATiempo(hora: Date, horario: { horaEntrada: Date; toleranciaMinutos: number }): boolean {
  const limite = horario.horaEntrada.getTime() + horario.toleranciaMinutos * 60_000;
  return hora.getTime() <= limite;
}

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number | null;
  tardanzas: number;
  aTiempo: number;
  porcentajePuntualidad: number | null;
  diasHabiles: number;
}

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

interface AsistenciaCruda {
  fecha: Date;
  hora: Date;
  seccionId: string;
  trabajadorId: string;
}

interface MapaHorarios {
  seccionHorario: Map<string, { horaEntrada: Date; toleranciaMinutos: number } | null>;
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

// Un trabajador puede tener más de una AsistenciaDiaria el mismo día (dos
// escaneos, entrada+salida, etc.) — sin esto, "presentes" contaría marcas
// en vez de días, e inconsistiría con la vista día-por-día (que solo
// muestra un renglón por día). Se queda con la marca más temprana de cada
// (trabajador, día) para clasificar puntualidad por la llegada real, no
// por un segundo escaneo posterior.
function unaMarcaPorDia(asistencias: AsistenciaCruda[]): AsistenciaCruda[] {
  const porClave = new Map<string, AsistenciaCruda>();
  for (const a of asistencias) {
    const clave = `${a.trabajadorId}|${aClaveDia(a.fecha)}`;
    const existente = porClave.get(clave);
    if (!existente || a.hora.getTime() < existente.hora.getTime()) {
      porClave.set(clave, a);
    }
  }
  return [...porClave.values()];
}

function calcularResumen(
  asistenciasCrudas: AsistenciaCruda[],
  mapas: MapaHorarios,
  diasHabiles: Date[],
  totalActivos: number,
  seccionFiltrada: boolean
): ResumenAsistencia {
  const asistencias = unaMarcaPorDia(asistenciasCrudas);
  let aTiempo = 0;
  let tardanzas = 0;

  for (const a of asistencias) {
    const horario = mapas.seccionHorario.get(a.seccionId);
    if (!horario) {
      continue;
    }
    if (llegoATiempo(a.hora, horario)) aTiempo++;
    else tardanzas++;
  }

  const totalClasificable = aTiempo + tardanzas;
  const porcentajePuntualidad = totalClasificable > 0 ? Math.round((aTiempo / totalClasificable) * 100) : null;

  // "ausentes" (persona-días) solo tiene sentido a nivel obra completa: sin
  // AsignacionDiaria no hay un roster esperado POR SECCIÓN, así que filtrar
  // por seccionId invalida ese cálculo (no sabemos cuántos trabajadores
  // "debían" estar en esa sección cada día).
  let ausentes: number | null = null;
  if (!seccionFiltrada) {
    const presentesPorDia = new Map<string, Set<string>>();
    for (const a of asistencias) {
      const clave = aClaveDia(a.fecha);
      if (!presentesPorDia.has(clave)) presentesPorDia.set(clave, new Set());
      presentesPorDia.get(clave)!.add(a.trabajadorId);
    }
    ausentes = diasHabiles.reduce((acc, dia) => {
      const presentesEseDia = presentesPorDia.get(aClaveDia(dia))?.size ?? 0;
      return acc + Math.max(totalActivos - presentesEseDia, 0);
    }, 0);
  }

  return {
    presentes: asistencias.length,
    ausentes,
    tardanzas,
    aTiempo,
    porcentajePuntualidad,
    diasHabiles: diasHabiles.length,
  };
}

function granularidadPara(desde: Date, hasta: Date): "dia" | "semana" | "mes" {
  const dias = (hasta.getTime() - desde.getTime()) / UN_DIA_MS + 1;
  if (dias <= 45) return "dia";
  if (dias <= 180) return "semana";
  return "mes";
}

function bucketsDelRango(desde: Date, hasta: Date, granularidad: "dia" | "semana" | "mes"): { inicio: Date; fin: Date }[] {
  const buckets: { inicio: Date; fin: Date }[] = [];

  if (granularidad === "dia") {
    for (let t = desde.getTime(); t <= hasta.getTime(); t += UN_DIA_MS) {
      const dia = new Date(t);
      buckets.push({ inicio: dia, fin: dia });
    }
    return buckets;
  }

  if (granularidad === "semana") {
    let cursor = new Date(desde);
    while (cursor.getTime() <= hasta.getTime()) {
      const finSemana = sumarDias(cursor, 6);
      buckets.push({ inicio: cursor, fin: finSemana.getTime() > hasta.getTime() ? hasta : finSemana });
      cursor = sumarDias(finSemana, 1);
    }
    return buckets;
  }

  // mes: por mes calendario, recortado a [desde, hasta].
  let cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  while (cursor.getTime() <= hasta.getTime()) {
    const finMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const inicioBucket = cursor.getTime() < desde.getTime() ? desde : cursor;
    const finBucket = finMes.getTime() > hasta.getTime() ? hasta : finMes;
    buckets.push({ inicio: inicioBucket, fin: finBucket });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return buckets;
}

function etiquetaBucket(inicio: Date, fin: Date, granularidad: "dia" | "semana" | "mes"): string {
  if (granularidad === "dia") return aClaveDia(inicio);
  if (granularidad === "semana") return `${aClaveDia(inicio)} – ${aClaveDia(fin)}`;
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${MESES[inicio.getUTCMonth()]} ${inicio.getUTCFullYear()}`;
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

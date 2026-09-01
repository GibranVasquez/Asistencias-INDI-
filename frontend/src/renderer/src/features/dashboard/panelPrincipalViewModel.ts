import { AsistenciaListada, TipoMarcacion } from "@/features/asistencias/api";
import { Horario } from "@/core/api/resources/horarios";
import { Seccion } from "@/core/api/resources/secciones";
import { Terminal } from "@/features/terminales/api";
import { fechaCivilEnTimezone, rangoCivil } from "@/features/dashboard/calendarioObra";

export type Rango = "dia" | "semana" | "mes";

export const UMBRAL_HORAS_INACTIVIDAD_ADMS = 24;
export const NOMBRES_DIA_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function terminalAdmsInactivo(terminal: Terminal, ahora: Date): boolean {
  if (terminal.tipo !== "adms") return false;
  if (!terminal.ultimaSincronizacion) return true;
  const horasDesdeUltimaSync = (ahora.getTime() - new Date(terminal.ultimaSincronizacion).getTime()) / 3_600_000;
  return horasDesdeUltimaSync > UMBRAL_HORAS_INACTIVIDAD_ADMS;
}

export function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Construye una fecha local solo como contenedor de un calendario civil. */
export function fechaDesdeCivil(fecha: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function fechaCivilActual(instante: Date, timezoneObra: string | null): string {
  if (!timezoneObra) return aFechaISO(instante);
  return fechaCivilEnTimezone(instante, timezoneObra) ?? aFechaISO(instante);
}

export { rangoCivil };

/** Fecha civil que llega en la respuesta de asistencias (DATE serializado). */
export function fechaCivilAsistencia(fechaISO: string): string {
  return fechaISO.slice(0, 10);
}

/** Hora civil que llega en la respuesta de asistencias (TIME serializado). */
export function horaCivilAsistencia(horaISO: string): string {
  const coincidencia = horaISO.match(/T(\d{2}:\d{2}(?::\d{2})?)/);
  return coincidencia?.[1] ?? horaISO.slice(0, 8);
}

function segundosHoraCivil(horaISO: string): number {
  const [horas, minutos, segundos = "0"] = horaCivilAsistencia(horaISO).split(":");
  return Number(horas) * 3600 + Number(minutos) * 60 + Number(segundos);
}

export function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  copia.setDate(copia.getDate() + diff);
  return copia;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function rangoConsulta(rango: Rango, hoy: Date): { inicio: Date; fin: Date } {
  if (rango === "dia") return { inicio: hoy, fin: hoy };
  if (rango === "semana") return { inicio: inicioDeSemana(hoy), fin: hoy };
  return { inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1), fin: hoy };
}

export function llegoATiempo(horaISO: string, horario: Pick<Horario, "horaEntrada" | "toleranciaMinutos">): boolean {
  const marcada = segundosHoraCivil(horaISO);
  const entrada = segundosHoraCivil(horario.horaEntrada);
  const limite = entrada + horario.toleranciaMinutos * 60;
  return marcada <= limite;
}

type AsistenciaParaPuntualidad = Pick<AsistenciaListada, "trabajadorId" | "fecha" | "seccionId" | "hora" | "tipoMarcacion">;

/** Selecciona la entrada cronológica de cada trabajador en su fecha civil. */
export function primeraMarcacionPorTrabajadorDia<T extends AsistenciaParaPuntualidad>(asistencias: T[]): T[] {
  const primeras = new Map<string, T>();
  for (const asistencia of asistencias) {
    const clave = `${asistencia.trabajadorId}|${fechaCivilAsistencia(asistencia.fecha)}`;
    const existente = primeras.get(clave);
    if (!existente || segundosHoraCivil(asistencia.hora) < segundosHoraCivil(existente.hora)) {
      primeras.set(clave, asistencia);
    }
  }
  return [...primeras.values()];
}

export function primeraEntradaPorTrabajadorDia<T extends AsistenciaParaPuntualidad>(asistencias: T[]): T[] {
  return primeraMarcacionPorTrabajadorDia(asistencias.filter((a) => a.tipoMarcacion === "entrada"));
}

export function calcularPuntualidad(
  asistencias: AsistenciaParaPuntualidad[],
  secciones: Pick<Seccion, "id" | "horarioId">[],
  horarios: Pick<Horario, "id" | "horaEntrada" | "toleranciaMinutos">[]
): { aTiempo: number; tarde: number } {
  const mapaHorarios = new Map(horarios.map((horario) => [horario.id, horario]));
  const mapaSecciones = new Map(secciones.map((seccion) => [seccion.id, seccion]));
  let aTiempo = 0;
  let tarde = 0;
  for (const asistencia of primeraEntradaPorTrabajadorDia(asistencias)) {
    const horarioId = asistencia.seccionId ? mapaSecciones.get(asistencia.seccionId)?.horarioId : undefined;
    const horario = horarioId ? mapaHorarios.get(horarioId) : undefined;
    if (!horario) continue;
    if (llegoATiempo(asistencia.hora, horario)) aTiempo++;
    else tarde++;
  }
  return { aTiempo, tarde };
}

export function bucketsPorDia(
  asistencias: Pick<AsistenciaListada, "fecha">[],
  inicio: Date,
  fin: Date
): { etiqueta: string; valor: number; esFuturo: boolean }[] {
  const conteos = new Map<string, number>();
  for (const asistencia of asistencias) {
    const clave = fechaCivilAsistencia(asistencia.fecha);
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
  }
  const dias: { etiqueta: string; valor: number; esFuturo: boolean }[] = [];
  const hoy = aFechaISO(new Date());
  for (let cursor = new Date(inicio); cursor <= fin; cursor = sumarDias(cursor, 1)) {
    const clave = aFechaISO(cursor);
    dias.push({ etiqueta: NOMBRES_DIA_CORTOS[cursor.getDay()], valor: conteos.get(clave) ?? 0, esFuturo: clave > hoy });
  }
  return dias;
}

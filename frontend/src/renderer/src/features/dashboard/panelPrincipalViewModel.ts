import { AsistenciaListada } from "@/features/asistencias/api";
import { Horario } from "@/core/api/resources/horarios";
import { Seccion } from "@/core/api/resources/secciones";
import { Terminal } from "@/features/terminales/api";

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
  const marcada = new Date(horaISO).getTime();
  const entrada = new Date(horario.horaEntrada).getTime();
  const limite = entrada + horario.toleranciaMinutos * 60_000;
  return marcada <= limite;
}

export function calcularPuntualidad(
  asistencias: Pick<AsistenciaListada, "seccionId" | "hora">[],
  secciones: Pick<Seccion, "id" | "horarioId">[],
  horarios: Pick<Horario, "id" | "horaEntrada" | "toleranciaMinutos">[]
): { aTiempo: number; tarde: number } {
  const mapaHorarios = new Map(horarios.map((horario) => [horario.id, horario]));
  const mapaSecciones = new Map(secciones.map((seccion) => [seccion.id, seccion]));
  let aTiempo = 0;
  let tarde = 0;
  for (const asistencia of asistencias) {
    const horarioId = mapaSecciones.get(asistencia.seccionId)?.horarioId;
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
    const clave = asistencia.fecha.slice(0, 10);
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

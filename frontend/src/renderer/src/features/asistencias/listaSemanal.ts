import { AsistenciaListada } from "@/features/asistencias/api";

export interface FilaListaSemanal {
  trabajadorId: string;
  trabajadorNombre: string;
  trabajadorCategoria: string;
  huellaRegistrada: boolean;
  frentes: string[];
  porDia: Map<string, AsistenciaListada[]>;
}

export function aFechaLocal(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function aISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function lunesDeSemana(fecha: Date): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dia = copia.getDay();
  copia.setDate(copia.getDate() + (dia === 0 ? -6 : 1 - dia));
  return copia;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function numeroSemana(fecha: Date): number {
  const inicio = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = inicio.getUTCDay() || 7;
  inicio.setUTCDate(inicio.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(inicio.getUTCFullYear(), 0, 1));
  return Math.ceil((((inicio.getTime() - inicioAnio.getTime()) / 86400000) + 1) / 7);
}

export function encabezadoDia(fechaISO: string): string {
  return aFechaLocal(fechaISO).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).replace(".", "").toUpperCase();
}

export function periodoSemanalLegible(fechaInicioISO: string, fechaFinISO: string): string {
  const inicio = aFechaLocal(fechaInicioISO);
  const fin = aFechaLocal(fechaFinISO);
  const opcionesInicio: Intl.DateTimeFormatOptions = inicio.getMonth() === fin.getMonth()
    ? { day: "numeric" }
    : { day: "numeric", month: "long" };
  const inicioTexto = inicio.toLocaleDateString("es-MX", opcionesInicio);
  const finTexto = fin.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return `${inicioTexto} al ${finTexto}`;
}

export function agruparAsistenciasPorTrabajador(asistencias: AsistenciaListada[]): FilaListaSemanal[] {
  const filas = new Map<string, FilaListaSemanal>();
  for (const asistencia of asistencias) {
    const fila = filas.get(asistencia.trabajadorId) ?? {
      trabajadorId: asistencia.trabajadorId,
      trabajadorNombre: asistencia.trabajadorNombre,
      trabajadorCategoria: asistencia.trabajadorCategoria,
      huellaRegistrada: asistencia.trabajadorHuellaRegistrada,
      frentes: [],
      porDia: new Map<string, AsistenciaListada[]>(),
    };
    if (!fila.frentes.includes(asistencia.seccionNombre)) fila.frentes.push(asistencia.seccionNombre);
    const dia = asistencia.fecha.slice(0, 10);
    const registrosDelDia = fila.porDia.get(dia) ?? [];
    registrosDelDia.push(asistencia);
    registrosDelDia.sort((a, b) => a.hora.localeCompare(b.hora));
    fila.porDia.set(dia, registrosDelDia);
    filas.set(asistencia.trabajadorId, fila);
  }
  return [...filas.values()].sort((a, b) => a.trabajadorNombre.localeCompare(b.trabajadorNombre));
}

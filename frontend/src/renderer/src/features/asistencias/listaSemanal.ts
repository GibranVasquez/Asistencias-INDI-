import { AsistenciaListada } from "@/features/asistencias/api";

export interface FilaListaSemanal {
  trabajadorId: string;
  trabajadorNombre: string;
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

export function encabezadoDia(fechaISO: string): string {
  return aFechaLocal(fechaISO).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).replace(".", "").toUpperCase();
}

export function agruparAsistenciasPorTrabajador(asistencias: AsistenciaListada[]): FilaListaSemanal[] {
  const filas = new Map<string, FilaListaSemanal>();
  for (const asistencia of asistencias) {
    const fila = filas.get(asistencia.trabajadorId) ?? {
      trabajadorId: asistencia.trabajadorId,
      trabajadorNombre: asistencia.trabajadorNombre,
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

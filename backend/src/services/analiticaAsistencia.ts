const UN_DIA_MS = 24 * 60 * 60 * 1000;

export interface AsistenciaCruda {
  fecha: Date;
  hora: Date;
  seccionId: string;
  trabajadorId: string;
}

export interface MapaHorarios {
  seccionHorario: Map<string, { horaEntrada: Date; toleranciaMinutos: number } | null>;
}

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number | null;
  tardanzas: number;
  aTiempo: number;
  porcentajePuntualidad: number | null;
  diasHabiles: number;
}

export function aClaveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA_MS);
}

export function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getUTCDay();
  return dia !== 0 && dia !== 6;
}

export function diasHabilesEnRango(inicio: Date, fin: Date): Date[] {
  const dias: Date[] = [];
  for (let t = inicio.getTime(); t <= fin.getTime(); t += UN_DIA_MS) {
    const d = new Date(t);
    if (esDiaHabil(d)) dias.push(d);
  }
  return dias;
}

export function llegoATiempo(
  hora: Date,
  horario: { horaEntrada: Date; toleranciaMinutos: number }
): boolean {
  const limite = horario.horaEntrada.getTime() + horario.toleranciaMinutos * 60_000;
  return hora.getTime() <= limite;
}

export function unaMarcaPorDia(asistencias: AsistenciaCruda[]): AsistenciaCruda[] {
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

export function calcularResumen(
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
    if (!horario) continue;
    if (llegoATiempo(a.hora, horario)) aTiempo++;
    else tardanzas++;
  }

  const totalClasificable = aTiempo + tardanzas;
  const porcentajePuntualidad = totalClasificable > 0 ? Math.round((aTiempo / totalClasificable) * 100) : null;

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

export function granularidadPara(desde: Date, hasta: Date): "dia" | "semana" | "mes" {
  const dias = (hasta.getTime() - desde.getTime()) / UN_DIA_MS + 1;
  if (dias <= 45) return "dia";
  if (dias <= 180) return "semana";
  return "mes";
}

export function bucketsDelRango(
  desde: Date,
  hasta: Date,
  granularidad: "dia" | "semana" | "mes"
): { inicio: Date; fin: Date }[] {
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

export function etiquetaBucket(inicio: Date, fin: Date, granularidad: "dia" | "semana" | "mes"): string {
  if (granularidad === "dia") return aClaveDia(inicio);
  if (granularidad === "semana") return `${aClaveDia(inicio)} – ${aClaveDia(fin)}`;
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${MESES[inicio.getUTCMonth()]} ${inicio.getUTCFullYear()}`;
}

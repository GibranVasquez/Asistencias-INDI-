export type RangoCalendario = "dia" | "semana" | "mes";

function fechaDesdePartes(partes: Intl.DateTimeFormatPart[]): string | null {
  const mapa = new Map(partes.map((parte) => [parte.type, parte.value]));
  const year = mapa.get("year");
  const month = mapa.get("month");
  const day = mapa.get("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function fechaCivilEnTimezone(instante: Date, timezone: string): string | null {
  try {
    return fechaDesdePartes(new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).formatToParts(instante));
  } catch {
    return null;
  }
}

export function sumarDiasFechaCivil(fecha: string, dias: number): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const calendario = new Date(Date.UTC(year, month - 1, day));
  calendario.setUTCDate(calendario.getUTCDate() + dias);
  return calendario.toISOString().slice(0, 10);
}

export function inicioSemanaCivil(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const calendario = new Date(Date.UTC(year, month - 1, day));
  const dia = calendario.getUTCDay();
  calendario.setUTCDate(calendario.getUTCDate() + (dia === 0 ? -6 : 1 - dia));
  return calendario.toISOString().slice(0, 10);
}

export function finSemanaCivil(fecha: string): string {
  return sumarDiasFechaCivil(inicioSemanaCivil(fecha), 6);
}

export function inicioMesCivil(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function finMesCivil(fecha: string): string {
  const [year, month] = fecha.slice(0, 7).split("-").map(Number);
  const siguiente = new Date(Date.UTC(year, month, 1));
  siguiente.setUTCDate(0);
  return siguiente.toISOString().slice(0, 10);
}

export function rangoCivil(rango: RangoCalendario, hoy: string): { inicio: string; fin: string } {
  if (rango === "dia") return { inicio: hoy, fin: hoy };
  if (rango === "semana") return { inicio: inicioSemanaCivil(hoy), fin: hoy };
  return { inicio: inicioMesCivil(hoy), fin: hoy };
}

export function relojEnTimezone(instante: Date, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone ?? undefined,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(instante);
  } catch {
    return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(instante);
  }
}

export function fechaLegibleEnTimezone(instante: Date, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone ?? undefined,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(instante);
  } catch {
    return instante.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
}

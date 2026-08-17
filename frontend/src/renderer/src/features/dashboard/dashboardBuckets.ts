interface AsistenciaConFecha {
  fecha: string;
}

function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function bucketsPorSemanaDelMes(
  asistencias: AsistenciaConFecha[],
  inicioMes: Date,
  hoy: Date
): { etiqueta: string; valor: number; esFuturo: boolean }[] {
  const conteos: { valor: number; esFuturo: boolean }[] = [];
  const hoyISO = aFechaISO(hoy);
  let cursor = new Date(inicioMes);
  while (cursor.getMonth() === inicioMes.getMonth()) {
    const finSemana = sumarDias(cursor, 6);
    let cuenta = 0;
    for (const asistencia of asistencias) {
      const fecha = asistencia.fecha.slice(0, 10);
      if (fecha >= aFechaISO(cursor) && fecha <= aFechaISO(finSemana)) cuenta++;
    }
    conteos.push({ valor: cuenta, esFuturo: aFechaISO(cursor) > hoyISO });
    cursor = sumarDias(finSemana, 1);
  }
  return conteos.map((semana, indice) => ({ etiqueta: `Sem ${indice + 1}`, ...semana }));
}

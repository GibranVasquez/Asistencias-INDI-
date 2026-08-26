import { Incidencia } from "@/features/incidencias/api";

export function fechaEventoVisible(incidencia: Incidencia): string {
  if (incidencia.fechaMarcacion && incidencia.horaMarcacion) {
    const [anio, mes, dia] = incidencia.fechaMarcacion.split("-");
    return `${dia}/${mes}/${anio} ${incidencia.horaMarcacion}`;
  }
  return new Date(incidencia.fechaEvento).toLocaleString("es-MX");
}

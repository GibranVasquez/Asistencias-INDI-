import { Incidencia } from "./api";

export type MotivoNoElegible = "YA_RECONCILIADA" | "SIN_OBRA" | "HISTORICO_AMBIGUO" | "PIN_NO_NUMERICO";
export type ResultadoElegibilidad = { elegible: true } | { elegible: false; motivo: MotivoNoElegible; mensaje: string };

export function normalizarPin(pin: string): number | null {
  const texto = pin.trim();
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) && numero <= 2_147_483_647 ? numero : null;
}

export function evaluarElegibilidad(incidencia: Incidencia): ResultadoElegibilidad {
  if (incidencia.estado !== "pendiente" || incidencia.asistenciaId !== null) {
    return { elegible: false, motivo: "YA_RECONCILIADA", mensaje: "Esta incidencia ya fue reconciliada." };
  }
  if (!incidencia.obraId) {
    return { elegible: false, motivo: "SIN_OBRA", mensaje: "La incidencia no tiene una Obra de origen registrada." };
  }
  if (!incidencia.fechaMarcacion || !incidencia.horaMarcacion) {
    return { elegible: false, motivo: "HISTORICO_AMBIGUO", mensaje: "Esta incidencia no contiene fecha/hora civil confiable y requiere revisión especial." };
  }
  if (normalizarPin(incidencia.identificadorDispositivo) === null) {
    return { elegible: false, motivo: "PIN_NO_NUMERICO", mensaje: "El PIN reportado no puede reconciliarse mediante este flujo." };
  }
  return { elegible: true };
}

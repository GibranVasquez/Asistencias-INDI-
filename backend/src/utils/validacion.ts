const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export function esStringNoVacia(valor: unknown, longitudMaxima: number): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && valor.length <= longitudMaxima;
}

export function esUUID(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_UUID.test(valor);
}

export function esFechaISO(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_FECHA.test(valor) && !Number.isNaN(Date.parse(valor));
}

export function esHora(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_HORA.test(valor);
}

export function esNumeroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

export function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
}

/**
 * Valida los campos monetarios manuales compartidos entre crear y corregir
 * una NominaSemanal. Devuelve el mensaje de error o null si todo es válido.
 */
export function validarMontosNomina(body: Record<string, unknown>): string | null {
  const { horasExtra, viaticosSemanal, viaticosMensual, descuentosVarios, aguinaldo } = body;

  if (!esNumeroNoNegativo(horasExtra)) {
    return "horasExtra es requerido y debe ser un número mayor o igual a 0.";
  }
  if (!esNumeroNoNegativo(viaticosSemanal)) {
    return "viaticosSemanal es requerido y debe ser un número mayor o igual a 0.";
  }
  if (!esNumeroNoNegativo(viaticosMensual)) {
    return "viaticosMensual es requerido y debe ser un número mayor o igual a 0.";
  }
  if (!esNumeroNoNegativo(descuentosVarios)) {
    return "descuentosVarios es requerido y debe ser un número mayor o igual a 0.";
  }
  if (aguinaldo !== undefined && aguinaldo !== null && !esNumeroNoNegativo(aguinaldo)) {
    return "aguinaldo debe ser un número mayor o igual a 0 si se envía.";
  }

  return null;
}

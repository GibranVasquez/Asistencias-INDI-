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

const zonasIANA = new Set(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
);

/** Valida identificadores IANA sin aceptar offsets ni abreviaturas ambiguas. */
export function esTimezoneIANA(valor: unknown): valor is string {
  if (typeof valor !== "string" || valor.length === 0 || valor.trim() !== valor) return false;
  if (/^(?:UTC|GMT)?[+-]\d{1,2}(?::?\d{2})?$/.test(valor) || /^(?:CST|CDT|EST|EDT|MST|MDT)$/.test(valor)) return false;
  if (valor === "UTC") return true;
  if (!valor.includes("/") || valor.startsWith("Etc/GMT")) return false;
  if (zonasIANA.size > 0) return zonasIANA.has(valor);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: valor }).format();
    return true;
  } catch {
    return false;
  }
}

export function esNumeroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

export function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
}

const LONGITUD_MINIMA_PASSWORD_SEGURA = 8;
const REGEX_PASSWORD_TIENE_LETRA = /[a-zA-Z]/;
const REGEX_PASSWORD_TIENE_NUMERO = /[0-9]/;

/**
 * Política mínima de contraseña, compartida entre alta de cuenta, cambio
 * propio y reseteo por administrador. Devuelve el mensaje de error (con el
 * detalle de qué falta) o null si cumple. No valida que `password` sea un
 * string no vacío — eso ya lo hace esStringNoVacia antes, en cada
 * middleware llamador.
 */
export function validarFortalezaPassword(password: string): string | null {
  const faltantes: string[] = [];

  if (password.length < LONGITUD_MINIMA_PASSWORD_SEGURA) {
    faltantes.push(`al menos ${LONGITUD_MINIMA_PASSWORD_SEGURA} caracteres`);
  }
  if (!REGEX_PASSWORD_TIENE_LETRA.test(password)) {
    faltantes.push("al menos una letra");
  }
  if (!REGEX_PASSWORD_TIENE_NUMERO.test(password)) {
    faltantes.push("al menos un número");
  }

  if (faltantes.length === 0) return null;
  return `La contraseña debe tener ${faltantes.join(", ")}.`;
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

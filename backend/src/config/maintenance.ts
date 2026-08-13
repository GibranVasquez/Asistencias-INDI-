const VALORES = new Map<string, boolean>([["true", true], ["false", false], ["1", true], ["0", false]]);

export function mantenimientoActivo(valor = process.env.MAINTENANCE_MODE): boolean {
  if (valor === undefined || valor === "") return false;
  const resultado = VALORES.get(valor.toLowerCase());
  if (resultado === undefined) throw new Error("MAINTENANCE_MODE debe ser true, false, 1 o 0.");
  return resultado;
}

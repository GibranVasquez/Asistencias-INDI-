import { MarcacionTerminalNormalizada } from "./types";

export type TipoMarcacionLocal = MarcacionTerminalNormalizada["tipoMarcacion"];
export function mapearPunchS922(punch: number | null): TipoMarcacionLocal {
  return ({ 0: "entrada", 1: "salida", 2: "salida_descanso", 3: "entrada_descanso", 4: "entrada_tiempo_extra", 5: "salida_tiempo_extra" } as Record<number, Exclude<TipoMarcacionLocal, null>>)[punch as number] ?? null;
}

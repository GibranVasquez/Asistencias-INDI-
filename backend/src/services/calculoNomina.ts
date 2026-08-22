import { Prisma } from "@prisma/client";

export const DIAS_POR_PERIODO = 7;

export interface EntradasCalculoNomina {
  sueldoBase: Prisma.Decimal;
  diasLaborados: number;
  viaticosSemanal: Prisma.Decimal;
  viaticosMensual: Prisma.Decimal;
  infonavitDescuento: Prisma.Decimal;
  descuentosVarios: Prisma.Decimal;
  aguinaldo: Prisma.Decimal | null;
  montoHorasExtra: Prisma.Decimal;
}

export interface ResultadoCalculoNomina {
  montoSueldo: Prisma.Decimal;
  montoHorasExtra: Prisma.Decimal;
  devengado: Prisma.Decimal;
  descontado: Prisma.Decimal;
  totalAPagar: Prisma.Decimal;
}

/** Calcula importes de nómina sin acceder a infraestructura ni aplicar validaciones de operación. */
export function calcularNomina(entradas: EntradasCalculoNomina): ResultadoCalculoNomina {
  const montoSueldo = entradas.sueldoBase.dividedBy(DIAS_POR_PERIODO).times(entradas.diasLaborados);
  const devengado = montoSueldo
    .plus(entradas.montoHorasExtra)
    .plus(entradas.viaticosSemanal)
    .plus(entradas.viaticosMensual)
    .plus(entradas.aguinaldo ?? new Prisma.Decimal(0));
  const descontado = entradas.infonavitDescuento.plus(entradas.descuentosVarios);

  return {
    montoSueldo,
    montoHorasExtra: entradas.montoHorasExtra,
    devengado,
    descontado,
    totalAPagar: devengado.minus(descontado),
  };
}

import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

function aClaveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export interface ResumenNomina {
  totalPagado: string;
  totalHorasExtra: string;
  totalInfonavit: string;
  totalDescuentos: string;
  cantidadNominas: number;
}

export interface FilaCategoriaNomina {
  categoria: string;
  totalPagado: string;
  cantidadTrabajadores: number;
}

export interface FilaPeriodoNomina {
  periodoInicio: string;
  periodoFin: string;
  totalPagado: string;
  montoHorasExtra: string;
  infonavitDescuento: string;
  descuentosVarios: string;
  cantidadNominas: number;
}

export interface ReporteNomina {
  desde: string;
  hasta: string;
  resumen: ResumenNomina;
  porCategoria: FilaCategoriaNomina[];
  porPeriodo: FilaPeriodoNomina[];
}

// No se desglosa por sección (a diferencia de asistencia): NominaSemanal no
// tiene sección propia y un trabajador puede haber marcado en secciones
// distintas esa semana (AsistenciaDiaria.seccionId varía por día) — sin una
// heurística acordada para resolver "la" sección de una nómina, categoria
// (campo real de Trabajador, sin ambigüedad) es el único desglose que se
// expone por ahora.
export async function obtenerReporteNomina(desdeISO: string, hastaISO: string): Promise<ReporteNomina> {
  const desde = aFechaUTC(desdeISO);
  const hasta = aFechaUTC(hastaISO);
  if (hasta.getTime() < desde.getTime()) {
    throw new AppError(400, "hasta no puede ser anterior a desde.");
  }

  const nominas = await prisma.nominaSemanal.findMany({
    where: { periodoInicio: { gte: desde, lte: hasta } },
    include: { trabajador: { select: { id: true, categoria: true } } },
    orderBy: { periodoInicio: "asc" },
  });

  const cero = new Prisma.Decimal(0);
  const resumenAcc = nominas.reduce(
    (acc, n) => ({
      totalPagado: acc.totalPagado.plus(n.totalAPagar),
      totalHorasExtra: acc.totalHorasExtra.plus(n.montoHorasExtra),
      totalInfonavit: acc.totalInfonavit.plus(n.infonavitDescuento),
      totalDescuentos: acc.totalDescuentos.plus(n.descuentosVarios),
    }),
    { totalPagado: cero, totalHorasExtra: cero, totalInfonavit: cero, totalDescuentos: cero }
  );

  const resumen: ResumenNomina = {
    totalPagado: resumenAcc.totalPagado.toFixed(2),
    totalHorasExtra: resumenAcc.totalHorasExtra.toFixed(2),
    totalInfonavit: resumenAcc.totalInfonavit.toFixed(2),
    totalDescuentos: resumenAcc.totalDescuentos.toFixed(2),
    cantidadNominas: nominas.length,
  };

  const porCategoriaMap = new Map<string, { total: Prisma.Decimal; trabajadores: Set<string> }>();
  for (const n of nominas) {
    const categoria = n.trabajador.categoria;
    if (!porCategoriaMap.has(categoria)) {
      porCategoriaMap.set(categoria, { total: cero, trabajadores: new Set() });
    }
    const entrada = porCategoriaMap.get(categoria)!;
    entrada.total = entrada.total.plus(n.totalAPagar);
    entrada.trabajadores.add(n.trabajador.id);
  }
  const porCategoria: FilaCategoriaNomina[] = [...porCategoriaMap.entries()]
    .map(([categoria, v]) => ({
      categoria,
      totalPagado: v.total.toFixed(2),
      cantidadTrabajadores: v.trabajadores.size,
    }))
    .sort((a, b) => Number(b.totalPagado) - Number(a.totalPagado));

  const porPeriodoMap = new Map<
    string,
    { periodoFin: Date; totalPagado: Prisma.Decimal; montoHorasExtra: Prisma.Decimal; infonavitDescuento: Prisma.Decimal; descuentosVarios: Prisma.Decimal; cantidad: number }
  >();
  for (const n of nominas) {
    const clave = aClaveDia(n.periodoInicio);
    if (!porPeriodoMap.has(clave)) {
      porPeriodoMap.set(clave, {
        periodoFin: n.periodoFin,
        totalPagado: cero,
        montoHorasExtra: cero,
        infonavitDescuento: cero,
        descuentosVarios: cero,
        cantidad: 0,
      });
    }
    const entrada = porPeriodoMap.get(clave)!;
    entrada.totalPagado = entrada.totalPagado.plus(n.totalAPagar);
    entrada.montoHorasExtra = entrada.montoHorasExtra.plus(n.montoHorasExtra);
    entrada.infonavitDescuento = entrada.infonavitDescuento.plus(n.infonavitDescuento);
    entrada.descuentosVarios = entrada.descuentosVarios.plus(n.descuentosVarios);
    entrada.cantidad++;
  }
  const porPeriodo: FilaPeriodoNomina[] = [...porPeriodoMap.entries()]
    .map(([periodoInicio, v]) => ({
      periodoInicio,
      periodoFin: aClaveDia(v.periodoFin),
      totalPagado: v.totalPagado.toFixed(2),
      montoHorasExtra: v.montoHorasExtra.toFixed(2),
      infonavitDescuento: v.infonavitDescuento.toFixed(2),
      descuentosVarios: v.descuentosVarios.toFixed(2),
      cantidadNominas: v.cantidad,
    }))
    .sort((a, b) => a.periodoInicio.localeCompare(b.periodoInicio));

  return { desde: desdeISO, hasta: hastaISO, resumen, porCategoria, porPeriodo };
}

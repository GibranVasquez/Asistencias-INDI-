import { NominaSemanal, Prisma, Trabajador } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

const DIAS_POR_PERIODO = 7;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

export interface DatosGeneracionNomina {
  periodoInicio: string; // YYYY-MM-DD
  periodoFin: string; // YYYY-MM-DD
  horasExtra: number;
  viaticosSemanal: number;
  viaticosMensual: number;
  descuentosVarios: number;
  aguinaldo?: number | null;
}

export interface DatosCorreccionNomina {
  horasExtra: number;
  viaticosSemanal: number;
  viaticosMensual: number;
  descuentosVarios: number;
  aguinaldo?: number | null;
}

export interface FiltrosNomina {
  trabajadorId?: string;
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

function aClaveDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function generarRangoDias(inicio: Date, fin: Date): Date[] {
  const dias: Date[] = [];
  for (let t = inicio.getTime(); t <= fin.getTime(); t += UN_DIA_MS) {
    dias.push(new Date(t));
  }
  return dias;
}

/**
 * Cuenta los días laborados día por día en [inicio, fin]: cuenta si hay una
 * AsistenciaDiaria ese día, o si no la hay pero existe un MovimientoTrabajador
 * activo ese día cuyo TipoMovimiento.cuentaComoDiaTrabajado sea true. Si hay
 * ambos el mismo día, gana la asistencia real (ya cuenta con solo eso).
 */
async function contarDiasLaborados(trabajadorId: string, inicio: Date, fin: Date): Promise<number> {
  const [asistencias, movimientos] = await Promise.all([
    prisma.asistenciaDiaria.findMany({
      where: { trabajadorId, fecha: { gte: inicio, lte: fin } },
      select: { fecha: true },
    }),
    prisma.movimientoTrabajador.findMany({
      where: {
        trabajadorId,
        fechaInicio: { lte: fin },
        OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }],
      },
      include: { tipoMovimiento: true },
    }),
  ]);

  const diasConAsistencia = new Set(asistencias.map((a) => aClaveDia(a.fecha)));
  const movimientosQueCuentan = movimientos.filter((m) => m.tipoMovimiento.cuentaComoDiaTrabajado);

  let diasLaborados = 0;
  for (const dia of generarRangoDias(inicio, fin)) {
    if (diasConAsistencia.has(aClaveDia(dia))) {
      diasLaborados++;
      continue;
    }

    const cubiertoPorMovimiento = movimientosQueCuentan.some(
      (m) => m.fechaInicio.getTime() <= dia.getTime() && (m.fechaFin === null || m.fechaFin.getTime() >= dia.getTime())
    );
    if (cubiertoPorMovimiento) {
      diasLaborados++;
    }
  }

  return diasLaborados;
}

/**
 * Solo exige una TarifaHoraExtra vigente cuando realmente hay horas extra que
 * pagar — con horasExtra=0 el monto es 0 sin importar la tarifa, y hoy el
 * catálogo está vacío a propósito (no hay un valor real todavía).
 */
async function calcularMontoHorasExtra(horasExtra: Prisma.Decimal, periodoInicio: Date): Promise<Prisma.Decimal> {
  if (horasExtra.isZero()) {
    return new Prisma.Decimal(0);
  }

  const tarifaVigente = await prisma.tarifaHoraExtra.findFirst({
    where: { vigenteDesde: { lte: periodoInicio } },
    orderBy: { vigenteDesde: "desc" },
  });
  if (!tarifaVigente) {
    throw new AppError(
      400,
      "No hay una tarifa de hora extra vigente para este periodo; da de alta una TarifaHoraExtra antes de registrar horas extra."
    );
  }

  return horasExtra.times(tarifaVigente.valor);
}

function serializarNomina(nomina: NominaSemanal) {
  return {
    periodoInicio: nomina.periodoInicio.toISOString().slice(0, 10),
    periodoFin: nomina.periodoFin.toISOString().slice(0, 10),
    diasLaborados: nomina.diasLaborados.toString(),
    montoSueldo: nomina.montoSueldo.toString(),
    horasExtra: nomina.horasExtra.toString(),
    montoHorasExtra: nomina.montoHorasExtra.toString(),
    viaticosSemanal: nomina.viaticosSemanal.toString(),
    viaticosMensual: nomina.viaticosMensual.toString(),
    infonavitDescuento: nomina.infonavitDescuento.toString(),
    descuentosVarios: nomina.descuentosVarios.toString(),
    aguinaldo: nomina.aguinaldo?.toString() ?? null,
    totalAPagar: nomina.totalAPagar.toString(),
    estatus: nomina.estatus,
  };
}

function requerirSueldoBase(trabajador: Trabajador): asserts trabajador is Trabajador & { sueldoBase: Prisma.Decimal } {
  if (trabajador.sueldoBase === null) {
    throw new AppError(400, "El trabajador no tiene sueldoBase configurado; RH debe completarlo antes de generar su nómina.");
  }
}

export async function generarNominaSemanal(
  usuarioId: string,
  trabajadorId: string,
  datos: DatosGeneracionNomina
): Promise<NominaSemanal> {
  const trabajador = await prisma.trabajador.findUnique({ where: { id: trabajadorId } });
  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }
  requerirSueldoBase(trabajador);

  const periodoInicio = aFechaUTC(datos.periodoInicio);
  const periodoFin = aFechaUTC(datos.periodoFin);

  const existente = await prisma.nominaSemanal.findUnique({
    where: { trabajadorId_periodoInicio: { trabajadorId, periodoInicio } },
  });
  if (existente) {
    throw new AppError(409, "Ya existe una nómina generada para este trabajador en ese periodo.");
  }

  const horasExtra = new Prisma.Decimal(datos.horasExtra);
  const montoHorasExtra = await calcularMontoHorasExtra(horasExtra, periodoInicio);
  const diasLaborados = await contarDiasLaborados(trabajadorId, periodoInicio, periodoFin);

  const viaticosSemanal = new Prisma.Decimal(datos.viaticosSemanal);
  const viaticosMensual = new Prisma.Decimal(datos.viaticosMensual);
  const descuentosVarios = new Prisma.Decimal(datos.descuentosVarios);
  const aguinaldo = datos.aguinaldo != null ? new Prisma.Decimal(datos.aguinaldo) : null;
  const infonavitDescuento = trabajador.infonavitMontoPorPeriodo ?? new Prisma.Decimal(0);

  const montoSueldo = trabajador.sueldoBase.dividedBy(DIAS_POR_PERIODO).times(diasLaborados);

  const totalAPagar = montoSueldo
    .plus(montoHorasExtra)
    .plus(viaticosSemanal)
    .plus(viaticosMensual)
    .plus(aguinaldo ?? new Prisma.Decimal(0))
    .minus(infonavitDescuento)
    .minus(descuentosVarios);

  return prisma.$transaction(async (tx) => {
    const nomina = await tx.nominaSemanal.create({
      data: {
        trabajadorId,
        periodoInicio,
        periodoFin,
        diasLaborados,
        montoSueldo,
        horasExtra,
        montoHorasExtra,
        viaticosSemanal,
        viaticosMensual,
        infonavitDescuento,
        descuentosVarios,
        aguinaldo,
        totalAPagar,
      },
    });

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "crear_nomina",
        entidad: "NominaSemanal",
        entidadId: nomina.id,
        detalle: serializarNomina(nomina),
      },
    });

    return nomina;
  });
}

export async function listarNominasSemanales(filtros: FiltrosNomina): Promise<NominaSemanal[]> {
  return prisma.nominaSemanal.findMany({
    where: filtros.trabajadorId ? { trabajadorId: filtros.trabajadorId } : undefined,
    orderBy: [{ periodoInicio: "desc" }],
  });
}

export async function obtenerNominaSemanal(id: string): Promise<NominaSemanal> {
  const nomina = await prisma.nominaSemanal.findUnique({ where: { id } });
  if (!nomina) {
    throw new AppError(404, "Nómina no encontrada.");
  }
  return nomina;
}

export async function corregirNominaSemanal(
  usuarioId: string,
  nominaId: string,
  datos: DatosCorreccionNomina
): Promise<NominaSemanal> {
  const nominaActual = await prisma.nominaSemanal.findUnique({ where: { id: nominaId } });
  if (!nominaActual) {
    throw new AppError(404, "Nómina no encontrada.");
  }

  const trabajador = await prisma.trabajador.findUnique({ where: { id: nominaActual.trabajadorId } });
  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }
  requerirSueldoBase(trabajador);

  const horasExtra = new Prisma.Decimal(datos.horasExtra);
  const montoHorasExtra = await calcularMontoHorasExtra(horasExtra, nominaActual.periodoInicio);
  const diasLaborados = await contarDiasLaborados(trabajador.id, nominaActual.periodoInicio, nominaActual.periodoFin);

  const viaticosSemanal = new Prisma.Decimal(datos.viaticosSemanal);
  const viaticosMensual = new Prisma.Decimal(datos.viaticosMensual);
  const descuentosVarios = new Prisma.Decimal(datos.descuentosVarios);
  const aguinaldo = datos.aguinaldo != null ? new Prisma.Decimal(datos.aguinaldo) : null;
  const infonavitDescuento = trabajador.infonavitMontoPorPeriodo ?? new Prisma.Decimal(0);

  const montoSueldo = trabajador.sueldoBase.dividedBy(DIAS_POR_PERIODO).times(diasLaborados);

  const totalAPagar = montoSueldo
    .plus(montoHorasExtra)
    .plus(viaticosSemanal)
    .plus(viaticosMensual)
    .plus(aguinaldo ?? new Prisma.Decimal(0))
    .minus(infonavitDescuento)
    .minus(descuentosVarios);

  return prisma.$transaction(async (tx) => {
    const nominaActualizada = await tx.nominaSemanal.update({
      where: { id: nominaId },
      data: {
        diasLaborados,
        montoSueldo,
        horasExtra,
        montoHorasExtra,
        viaticosSemanal,
        viaticosMensual,
        infonavitDescuento,
        descuentosVarios,
        aguinaldo,
        totalAPagar,
      },
    });

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "corregir_nomina",
        entidad: "NominaSemanal",
        entidadId: nominaId,
        detalle: {
          anterior: serializarNomina(nominaActual),
          nuevo: serializarNomina(nominaActualizada),
        },
      },
    });

    return nominaActualizada;
  });
}

import { MovimientoTrabajador, NominaEstatus, NominaSemanal, Prisma, Trabajador, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

const DIAS_POR_PERIODO = 7;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

export interface VistaPreviaTrabajador {
  id: string;
  nombreCompleto: string;
  categoria: string;
  seccionesTrabajadas: string[];
  diasLaborados: number;
  datosIncompletos: boolean;
  nominaExistente: {
    id: string;
    horasExtra: string;
    viaticosSemanal: string;
    viaticosMensual: string;
    descuentosVarios: string;
    aguinaldo: string | null;
    montoHorasExtra: string;
    infonavitDescuento: string;
    totalAPagar: string;
    estatus: NominaEstatus;
  } | null;
}

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
 * Cuenta los días laborados día por día en [inicio, fin] a partir de datos ya
 * cargados: cuenta si hay una AsistenciaDiaria ese día, o si no la hay pero
 * existe un MovimientoTrabajador activo ese día cuyo TipoMovimiento.
 * cuentaComoDiaTrabajado sea true. Si hay ambos el mismo día, gana la
 * asistencia real (ya cuenta con solo eso). Pura (sin acceso a datos) para
 * que el path por-trabajador (una consulta por trabajador) y el de vista
 * previa en lote (una consulta para todos) compartan exactamente la misma
 * regla y no puedan divergir.
 */
function contarDiasLaboradosPuro(
  diasConAsistencia: Set<string>,
  movimientosQueCuentan: Pick<MovimientoTrabajador, "fechaInicio" | "fechaFin">[],
  inicio: Date,
  fin: Date
): number {
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

  return contarDiasLaboradosPuro(diasConAsistencia, movimientosQueCuentan, inicio, fin);
}

/**
 * totalAPagar negativo no es un estado válido a guardar ni mostrar: es una
 * señal de que los montos manuales (normalmente descuentosVarios) se
 * capturaron mal para lo que el trabajador realmente devengó esa semana.
 * Rechaza con 400 y deja que RH decida manualmente cómo corregirlo — no es
 * decisión nuestra "recortar a 0" ni "acarrear" el faltante a otra semana.
 */
function verificarTotalNoNegativo(devengado: Prisma.Decimal, descontado: Prisma.Decimal, totalAPagar: Prisma.Decimal): void {
  if (totalAPagar.isNegative()) {
    throw new AppError(
      400,
      `El total de descuentos ($${descontado.toFixed(2)}) supera lo devengado esta semana ($${devengado.toFixed(2)}). Revisa los montos capturados antes de generar/corregir esta nómina.`
    );
  }
}

function datosNominaIncompletos(trabajador: Trabajador): boolean {
  return (
    trabajador.sueldoBase === null ||
    trabajador.fechaIngreso === null ||
    trabajador.banco === null ||
    trabajador.clabe === null ||
    trabajador.cuentaBancaria === null
  );
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

  const devengado = montoSueldo.plus(montoHorasExtra).plus(viaticosSemanal).plus(viaticosMensual).plus(aguinaldo ?? new Prisma.Decimal(0));
  const descontado = infonavitDescuento.plus(descuentosVarios);
  const totalAPagar = devengado.minus(descontado);
  verificarTotalNoNegativo(devengado, descontado, totalAPagar);

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

/**
 * Vista de solo lectura para la captura masiva de nómina semanal: por cada
 * trabajador activo resuelve días laborados, secciones trabajadas esa
 * semana y si ya tiene nómina generada para ese periodo — todo en 4
 * consultas (no una por trabajador) para que sea viable con ~137
 * trabajadores. No persiste nada; POST/PATCH /nominas siguen siendo el
 * único camino de escritura.
 */
export async function obtenerVistaPreviaNomina(periodoInicioISO: string, periodoFinISO: string): Promise<VistaPreviaTrabajador[]> {
  const periodoInicio = aFechaUTC(periodoInicioISO);
  const periodoFin = aFechaUTC(periodoFinISO);

  const [trabajadores, asistencias, movimientos, nominas] = await Promise.all([
    prisma.trabajador.findMany({ where: { estatus: TrabajadorEstatus.activo }, orderBy: { nombreCompleto: "asc" } }),
    prisma.asistenciaDiaria.findMany({
      where: { fecha: { gte: periodoInicio, lte: periodoFin } },
      include: { seccion: { select: { nombre: true } } },
    }),
    prisma.movimientoTrabajador.findMany({
      where: {
        fechaInicio: { lte: periodoFin },
        OR: [{ fechaFin: null }, { fechaFin: { gte: periodoInicio } }],
      },
      include: { tipoMovimiento: true },
    }),
    prisma.nominaSemanal.findMany({ where: { periodoInicio } }),
  ]);

  const asistenciasPorTrabajador = new Map<string, typeof asistencias>();
  for (const a of asistencias) {
    const lista = asistenciasPorTrabajador.get(a.trabajadorId) ?? [];
    lista.push(a);
    asistenciasPorTrabajador.set(a.trabajadorId, lista);
  }

  const movimientosPorTrabajador = new Map<string, typeof movimientos>();
  for (const m of movimientos) {
    if (!m.tipoMovimiento.cuentaComoDiaTrabajado) continue;
    const lista = movimientosPorTrabajador.get(m.trabajadorId) ?? [];
    lista.push(m);
    movimientosPorTrabajador.set(m.trabajadorId, lista);
  }

  const nominaPorTrabajador = new Map(nominas.map((n) => [n.trabajadorId, n]));

  return trabajadores.map((trabajador) => {
    const asistenciasTrabajador = asistenciasPorTrabajador.get(trabajador.id) ?? [];
    const diasConAsistencia = new Set(asistenciasTrabajador.map((a) => aClaveDia(a.fecha)));
    const movimientosQueCuentan = movimientosPorTrabajador.get(trabajador.id) ?? [];
    const diasLaborados = contarDiasLaboradosPuro(diasConAsistencia, movimientosQueCuentan, periodoInicio, periodoFin);
    const seccionesTrabajadas = [...new Set(asistenciasTrabajador.map((a) => a.seccion.nombre))];
    const nominaExistente = nominaPorTrabajador.get(trabajador.id);

    return {
      id: trabajador.id,
      nombreCompleto: trabajador.nombreCompleto,
      categoria: trabajador.categoria,
      seccionesTrabajadas,
      diasLaborados,
      datosIncompletos: datosNominaIncompletos(trabajador),
      nominaExistente: nominaExistente
        ? {
            id: nominaExistente.id,
            horasExtra: nominaExistente.horasExtra.toString(),
            viaticosSemanal: nominaExistente.viaticosSemanal.toString(),
            viaticosMensual: nominaExistente.viaticosMensual.toString(),
            descuentosVarios: nominaExistente.descuentosVarios.toString(),
            aguinaldo: nominaExistente.aguinaldo?.toString() ?? null,
            montoHorasExtra: nominaExistente.montoHorasExtra.toString(),
            infonavitDescuento: nominaExistente.infonavitDescuento.toString(),
            totalAPagar: nominaExistente.totalAPagar.toString(),
            estatus: nominaExistente.estatus,
          }
        : null,
    };
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

  const devengado = montoSueldo.plus(montoHorasExtra).plus(viaticosSemanal).plus(viaticosMensual).plus(aguinaldo ?? new Prisma.Decimal(0));
  const descontado = infonavitDescuento.plus(descuentosVarios);
  const totalAPagar = devengado.minus(descontado);
  verificarTotalNoNegativo(devengado, descontado, totalAPagar);

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

import { Prisma, TarifaHoraExtra } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosTarifaHoraExtra {
  valor: number;
  vigenteDesde: string; // YYYY-MM-DD
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

/**
 * Una NominaSemanal con horasExtra > 0 "usa" la tarifa vigente al momento de
 * su periodoInicio (misma regla que nomina.service.calcularMontoHorasExtra:
 * la tarifa con vigenteDesde más reciente que sea <= periodoInicio). Esa
 * tarifa está en uso mientras el periodoInicio de la nómina caiga en
 * [tarifa.vigenteDesde, siguienteTarifa.vigenteDesde) — o sin límite superior
 * si no hay una tarifa posterior.
 */
async function tarifaEstaEnUso(tarifa: TarifaHoraExtra): Promise<boolean> {
  const siguiente = await prisma.tarifaHoraExtra.findFirst({
    where: { vigenteDesde: { gt: tarifa.vigenteDesde } },
    orderBy: { vigenteDesde: "asc" },
  });

  const enUso = await prisma.nominaSemanal.count({
    where: {
      horasExtra: { gt: 0 },
      periodoInicio: {
        gte: tarifa.vigenteDesde,
        ...(siguiente ? { lt: siguiente.vigenteDesde } : {}),
      },
    },
  });

  return enUso > 0;
}

export async function crearTarifaHoraExtra(usuarioActorId: string, datos: DatosTarifaHoraExtra): Promise<TarifaHoraExtra> {
  const vigenteDesde = aFechaUTC(datos.vigenteDesde);

  const existente = await prisma.tarifaHoraExtra.findUnique({ where: { vigenteDesde } });
  if (existente) {
    throw new AppError(409, "Ya existe una tarifa de hora extra vigente desde esa fecha.");
  }

  return prisma.$transaction(async (tx) => {
    const tarifa = await tx.tarifaHoraExtra.create({ data: { valor: new Prisma.Decimal(datos.valor), vigenteDesde } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "crear_tarifa_hora_extra",
        entidad: "TarifaHoraExtra",
        entidadId: tarifa.id,
        detalle: { valor: tarifa.valor.toString(), vigenteDesde: datos.vigenteDesde },
      },
    });

    return tarifa;
  });
}

export async function listarTarifasHoraExtra(): Promise<TarifaHoraExtra[]> {
  return prisma.tarifaHoraExtra.findMany({ orderBy: { vigenteDesde: "desc" } });
}

export async function obtenerTarifaHoraExtra(id: string): Promise<TarifaHoraExtra> {
  const tarifa = await prisma.tarifaHoraExtra.findUnique({ where: { id } });
  if (!tarifa) {
    throw new AppError(404, "Tarifa de hora extra no encontrada.");
  }
  return tarifa;
}

export async function editarTarifaHoraExtra(
  usuarioActorId: string,
  id: string,
  datos: DatosTarifaHoraExtra
): Promise<TarifaHoraExtra> {
  const tarifa = await obtenerTarifaHoraExtra(id);

  if (await tarifaEstaEnUso(tarifa)) {
    throw new AppError(409, "No se puede editar: esta tarifa ya fue usada en al menos una nómina generada.");
  }

  const vigenteDesde = aFechaUTC(datos.vigenteDesde);
  const conflicto = await prisma.tarifaHoraExtra.findUnique({ where: { vigenteDesde } });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe una tarifa de hora extra vigente desde esa fecha.");
  }

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.tarifaHoraExtra.update({
      where: { id },
      data: { valor: new Prisma.Decimal(datos.valor), vigenteDesde },
    });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_tarifa_hora_extra",
        entidad: "TarifaHoraExtra",
        entidadId: id,
        detalle: {
          anterior: { valor: tarifa.valor.toString(), vigenteDesde: tarifa.vigenteDesde.toISOString().slice(0, 10) },
          nuevo: { valor: actualizada.valor.toString(), vigenteDesde: datos.vigenteDesde },
        },
      },
    });

    return actualizada;
  });
}

export async function borrarTarifaHoraExtra(usuarioActorId: string, id: string): Promise<void> {
  const tarifa = await obtenerTarifaHoraExtra(id);

  if (await tarifaEstaEnUso(tarifa)) {
    throw new AppError(409, "No se puede borrar: esta tarifa ya fue usada en al menos una nómina generada.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tarifaHoraExtra.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "borrar_tarifa_hora_extra",
        entidad: "TarifaHoraExtra",
        entidadId: id,
        detalle: { valor: tarifa.valor.toString(), vigenteDesde: tarifa.vigenteDesde.toISOString().slice(0, 10) },
      },
    });
  });
}

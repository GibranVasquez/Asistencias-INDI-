import { prisma } from "../utils/prisma";

export interface FiltrosIncidencias { busqueda?: string; desde?: Date; hasta?: Date; pagina: number; limite: number }

export async function listarIncidencias(filtros: FiltrosIncidencias) {
  const where = {
    marcadoEn: filtros.desde || filtros.hasta ? { gte: filtros.desde, lte: filtros.hasta } : undefined,
    OR: filtros.busqueda ? [
      { pinDispositivo: { contains: filtros.busqueda, mode: "insensitive" as const } },
      { terminal: { username: { contains: filtros.busqueda, mode: "insensitive" as const } } },
      { terminal: { ubicacion: { contains: filtros.busqueda, mode: "insensitive" as const } } },
    ] : undefined,
  };
  const [eventos, total] = await Promise.all([
    prisma.eventoNoReconciliado.findMany({
      where,
      select: { id: true, pinDispositivo: true, marcadoEn: true, creadoEn: true, terminal: { select: { username: true, ubicacion: true } } },
      orderBy: { creadoEn: "desc" }, skip: (filtros.pagina - 1) * filtros.limite, take: filtros.limite,
    }),
    prisma.eventoNoReconciliado.count({ where }),
  ]);
  return {
    items: eventos.map((evento) => ({
      id: evento.id,
      tipo: "ADMS_NO_RECONCILIADO" as const,
      estado: "pendiente" as const,
      fechaEvento: evento.marcadoEn.toISOString(),
      detectadoEn: evento.creadoEn.toISOString(),
      identificadorDispositivo: evento.pinDispositivo,
      terminal: evento.terminal.username,
      ubicacion: evento.terminal.ubicacion,
    })),
    total, pagina: filtros.pagina, limite: filtros.limite,
  };
}

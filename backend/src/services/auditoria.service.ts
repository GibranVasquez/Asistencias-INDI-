import { prisma } from "../utils/prisma";

export interface FiltrosAuditoria {
  entidad?: string;
  entidadId?: string;
  accion?: string;
  actor?: string;
  desde?: Date;
  hasta?: Date;
  pagina: number;
  limite: number;
}

export interface AuditoriaListada {
  id: string;
  actorUsername: string;
  accion: string;
  entidad: string;
  entidadId: string;
  fecha: string;
  detalle: string[];
}

export interface PaginaAuditoria {
  registros: AuditoriaListada[];
  total: number;
  pagina: number;
  limite: number;
}

const CLAVES_TEXTO_SEGURAS = new Set(["username", "rol", "nombre", "categoria", "activoNuevo"]);
const CAMPOS_OCULTOS = /password|hash|token|authorization|cookie|secret|clabe|banco|sueldo|monto|descuento|viatico|aguinaldo/i;

// AuditLog es información sensible. La API nunca devuelve el JSON persistido:
// solo transforma una lista explícita de claves de bajo riesgo en textos de
// presentación. Cualquier clave histórica o futura no reconocida queda oculta.
export function sanitizarDetalleAuditoria(detalle: unknown): string[] {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) return [];
  const origen = detalle as Record<string, unknown>;
  const resultado: string[] = [];

  for (const clave of CLAVES_TEXTO_SEGURAS) {
    const valor = origen[clave];
    if ((typeof valor === "string" || typeof valor === "boolean") && !CAMPOS_OCULTOS.test(clave)) {
      resultado.push(`${clave}: ${String(valor)}`);
    }
  }

  if (Array.isArray(origen.camposEditados)) {
    const campos = origen.camposEditados.filter((campo): campo is string => typeof campo === "string" && !CAMPOS_OCULTOS.test(campo));
    if (campos.length > 0) resultado.push(`Campos actualizados: ${campos.join(", ")}`);
    else if (origen.camposEditados.length > 0) resultado.push("Se actualizaron campos sensibles (valores ocultos).");
  }

  return resultado.slice(0, 6);
}

// Solo lectura, rol=administrador (ver rutas). AuditLog.usuarioId es quien
// EJECUTÓ la acción (el actor), no la entidad afectada — se denormaliza su
// username aquí porque no hay otro endpoint que se lo resuelva al cliente.
export async function listarAuditoria(filtros: FiltrosAuditoria): Promise<PaginaAuditoria> {
  const where = {
    entidad: filtros.entidad,
    entidadId: filtros.entidadId,
    accion: filtros.accion,
    usuario: filtros.actor ? { username: { contains: filtros.actor, mode: "insensitive" as const } } : undefined,
    fecha: filtros.desde || filtros.hasta ? { gte: filtros.desde, lte: filtros.hasta } : undefined,
  };
  const [registros, total] = await Promise.all([prisma.auditLog.findMany({
    where,
    select: {
      id: true, accion: true, entidad: true, entidadId: true, fecha: true, detalle: true,
      usuario: { select: { username: true } },
    },
    skip: (filtros.pagina - 1) * filtros.limite,
    take: filtros.limite,
    orderBy: { fecha: "desc" },
  }), prisma.auditLog.count({ where })]);

  return {
    registros: registros.map((r) => ({
      id: r.id,
      actorUsername: r.usuario.username,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidadId,
      fecha: r.fecha.toISOString(),
      detalle: sanitizarDetalleAuditoria(r.detalle),
    })),
    total,
    pagina: filtros.pagina,
    limite: filtros.limite,
  };
}

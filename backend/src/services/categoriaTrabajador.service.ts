import { CategoriaTrabajador, Prisma, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { conManejoDeUnicidad } from "../utils/erroresPrisma";

export interface DatosCategoriaTrabajador {
  nombre: string;
  sueldoBaseDefault: number | null;
  esDefault: boolean;
}

export async function crearCategoriaTrabajador(
  usuarioActorId: string,
  datos: DatosCategoriaTrabajador
): Promise<CategoriaTrabajador> {
  const existente = await prisma.categoriaTrabajador.findUnique({ where: { nombre: datos.nombre } });
  if (existente) {
    throw new AppError(409, "Ya existe una categoría con ese nombre.");
  }

  return conManejoDeUnicidad(
    () =>
      prisma.$transaction(async (tx) => {
        // A lo más una fila con esDefault=true (ver comentario en schema.prisma) —
        // Prisma no tiene un índice único parcial sin SQL crudo, así que se
        // garantiza aquí, igual que el resto de las validaciones de este archivo.
        if (datos.esDefault) {
          await tx.categoriaTrabajador.updateMany({ where: { esDefault: true }, data: { esDefault: false } });
        }

        const categoria = await tx.categoriaTrabajador.create({
          data: {
            nombre: datos.nombre,
            sueldoBaseDefault: datos.sueldoBaseDefault === null ? null : new Prisma.Decimal(datos.sueldoBaseDefault),
            esDefault: datos.esDefault,
          },
        });

        await tx.auditLog.create({
          data: {
            usuarioId: usuarioActorId,
            accion: "crear_categoria_trabajador",
            entidad: "CategoriaTrabajador",
            entidadId: categoria.id,
            detalle: { nombre: categoria.nombre },
          },
        });

        return categoria;
      }),
    "Ya existe una categoría con ese nombre."
  );
}

export async function listarCategoriasTrabajador(): Promise<CategoriaTrabajador[]> {
  return prisma.categoriaTrabajador.findMany({ orderBy: { nombre: "asc" } });
}

export async function obtenerCategoriaTrabajador(id: string): Promise<CategoriaTrabajador> {
  const categoria = await prisma.categoriaTrabajador.findUnique({ where: { id } });
  if (!categoria) {
    throw new AppError(404, "Categoría no encontrada.");
  }
  return categoria;
}

export async function editarCategoriaTrabajador(
  usuarioActorId: string,
  id: string,
  datos: DatosCategoriaTrabajador
): Promise<CategoriaTrabajador> {
  const actual = await obtenerCategoriaTrabajador(id);

  const conflicto = await prisma.categoriaTrabajador.findUnique({ where: { nombre: datos.nombre } });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe una categoría con ese nombre.");
  }

  return conManejoDeUnicidad(
    () =>
      prisma.$transaction(async (tx) => {
        if (datos.esDefault) {
          await tx.categoriaTrabajador.updateMany({
            where: { esDefault: true, id: { not: id } },
            data: { esDefault: false },
          });
        }

        const categoria = await tx.categoriaTrabajador.update({
          where: { id },
          data: {
            nombre: datos.nombre,
            sueldoBaseDefault: datos.sueldoBaseDefault === null ? null : new Prisma.Decimal(datos.sueldoBaseDefault),
            esDefault: datos.esDefault,
          },
        });

        // Trabajador.categoria es texto libre, no una FK a esta tabla (ver
        // schema.prisma) — sin esto, renombrar una categoría del catálogo
        // desconecta en silencio a todos los trabajadores que ya tenían el
        // nombre viejo: "aplicar sueldo a todos los de esta categoría"
        // (aplicarSueldoATodosDeCategoria, más abajo) busca por el nombre
        // NUEVO, que nadie tiene todavía, y da un 404 falso de "no hay
        // trabajadores activos" sin ninguna pista de por qué. Solo corre
        // si el nombre de verdad cambió.
        if (actual.nombre !== datos.nombre) {
          await tx.trabajador.updateMany({
            where: { categoria: actual.nombre },
            data: { categoria: datos.nombre },
          });
        }

        await tx.auditLog.create({
          data: {
            usuarioId: usuarioActorId,
            accion: "editar_categoria_trabajador",
            entidad: "CategoriaTrabajador",
            entidadId: id,
            detalle: { nombreAnterior: actual.nombre, nombreNuevo: categoria.nombre },
          },
        });

        return categoria;
      }),
    "Ya existe una categoría con ese nombre."
  );
}

export async function borrarCategoriaTrabajador(usuarioActorId: string, id: string): Promise<void> {
  const categoria = await obtenerCategoriaTrabajador(id);

  await prisma.$transaction(async (tx) => {
    await tx.categoriaTrabajador.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "borrar_categoria_trabajador",
        entidad: "CategoriaTrabajador",
        entidadId: id,
        detalle: { nombre: categoria.nombre },
      },
    });
  });
}

export interface ResultadoAplicarSueldo {
  afectados: number;
}

// Acción explícita, separada del CRUD normal de la categoría — nunca se
// dispara sola por editar sueldoBaseDefault. Solo trabajadores activos (dar
// de baja/becario no tiene sentido tocarlos), y el AuditLog registra
// únicamente el nombre del campo cambiado, nunca el valor — mismo criterio
// que editarTrabajador (ver trabajador.service.ts) para que un
// administrador con acceso a /auditoria pero no a /trabajadores no pueda
// recuperar sueldos por ahí. Seguro respecto a nómina ya generada: ver el
// comentario en schema.prisma sobre CategoriaTrabajador — sueldoBase se
// snapshotea dentro de NominaSemanal al generar, nunca se relee en vivo.
export async function aplicarSueldoATodosDeCategoria(
  usuarioActorId: string,
  categoriaId: string,
  nuevoSueldoBase: number
): Promise<ResultadoAplicarSueldo> {
  const categoria = await obtenerCategoriaTrabajador(categoriaId);

  const trabajadores = await prisma.trabajador.findMany({
    where: { categoria: categoria.nombre, estatus: TrabajadorEstatus.activo },
    select: { id: true },
  });

  if (trabajadores.length === 0) {
    throw new AppError(404, `No hay trabajadores activos con categoria="${categoria.nombre}".`);
  }

  const ids = trabajadores.map((t) => t.id);

  return prisma.$transaction(async (tx) => {
    await tx.trabajador.updateMany({
      where: { id: { in: ids } },
      data: { sueldoBase: new Prisma.Decimal(nuevoSueldoBase) },
    });

    await tx.auditLog.createMany({
      data: ids.map((trabajadorId) => ({
        usuarioId: usuarioActorId,
        accion: "aplicar_sueldo_masivo_por_categoria",
        entidad: "Trabajador",
        entidadId: trabajadorId,
        detalle: { camposEditados: ["sueldoBase"], categoria: categoria.nombre },
      })),
    });

    return { afectados: ids.length };
  });
}

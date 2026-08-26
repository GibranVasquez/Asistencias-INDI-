import { RolUsuario, Seccion, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { verificarAccesoSeccion } from "../utils/accesoSeccion";
import { conManejoDeUnicidad } from "../utils/erroresPrisma";

export interface DatosAltaSeccion {
  obraId: string;
  nombre: string;
  horarioId?: string | null;
  encargadoIds?: string[];
  tramoUbicacion?: string | null;
}

export interface DatosEdicionSeccion {
  nombre: string;
  // undefined = no tocar el horario actual; null = quitarlo; string = asignar ese.
  horarioId?: string | null;
  // undefined = no tocar los encargados actuales; array (incluso vacío) =
  // reemplaza la lista completa (set, no connect — así se puede quitar uno).
  encargadoIds?: string[];
  tramoUbicacion?: string | null;
}

export interface SeccionConEncargados extends Seccion {
  encargados: { id: string; username: string; trabajadorId: string | null; trabajadorNombre: string | null; trabajadorCategoria: string | null }[];
  responsablesTramo: { id: string; nombreCompleto: string; categoria: string; estatus: TrabajadorEstatus }[];
}

export interface ResponsableTramoBasico {
  id: string;
  nombreCompleto: string;
  categoria: string;
  estatus: TrabajadorEstatus;
}

interface TrabajadorResumen {
  trabajadorId: string;
  nombreCompleto: string;
}

export interface ResumenSeccionHoy {
  fecha: string;
  seccionId: string;
  // asignado=false cuando la marcacion real no coincide con el plan del dia
  // (no esta asignado hoy a esta seccion, o esta asignado a otra) — la
  // asistencia real nunca se oculta solo porque no cuadra con la asignacion.
  presentes: (TrabajadorResumen & { hora: string; asignado: boolean })[];
  sinAsignacion: boolean;
  totalAsignado: number | null;
  ausentes: TrabajadorResumen[] | null;
}

const ZONA_HORARIA_OBRA = "America/Mexico_City";

// "Hoy" segun la fecha calendario real de la obra (America/Mexico_City),
// no segun el reloj/TZ del proceso del servidor — el resto del sistema
// (POST /asignaciones, GET /asignaciones/sugerencia, el kiosco) ya trabaja
// con la fecha local que manda el frontend; calcular "hoy" en UTC aqui
// hacia que este endpoint "saltara" al dia siguiente ~5-6 horas antes que
// el resto del sistema (Mexico esta detras de UTC), rompiendo la vista de
// hoy durante esas horas (bug real confirmado en produccion: ECS corre en
// UTC por defecto, nadie configuraba TZ). Usa Intl.DateTimeFormat con
// timeZone explicito en vez de depender de que el proceso tenga la TZ
// correcta configurada (defensa en profundidad — la TZ del contenedor
// tambien se fija a nivel de infraestructura, ver Dockerfile/ECS, pero
// este calculo es correcto sin importar como quede configurado eso).
function hoyEnZonaObra(): Date {
  const fechaISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_OBRA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  return new Date(`${fechaISO}T00:00:00Z`);
}

async function verificarHorarioExiste(horarioId: string | null | undefined): Promise<void> {
  if (!horarioId) return;
  const horario = await prisma.horario.findUnique({ where: { id: horarioId } });
  if (!horario) {
    throw new AppError(404, "El horario indicado no existe.");
  }
}

// Mismo invariante que ya exige validarAltaUsuario del lado de Usuario:
// seccionesAsignadas (aquí, encargados) solo tiene sentido para cuentas
// rol=encargado_seccion — sin esto, asignar un encargado desde el lado de
// Sección podría dejar a un rh/administrador con la relación poblada.
async function verificarEncargadosValidos(encargadoIds: string[] | undefined): Promise<void> {
  if (!encargadoIds || encargadoIds.length === 0) return;

  const usuarios = await prisma.usuario.findMany({ where: { id: { in: encargadoIds } } });
  if (usuarios.length !== encargadoIds.length) {
    throw new AppError(400, "Uno o más encargados indicados no existen.");
  }

  const conRolInvalido = usuarios.some((u) => u.rol !== RolUsuario.encargado_seccion);
  if (conRolInvalido) {
    throw new AppError(400, "Todos los encargados indicados deben ser cuentas con rol=encargado_seccion.");
  }
}

export async function crearSeccion(usuarioActorId: string, datos: DatosAltaSeccion): Promise<Seccion> {
  const obra = await prisma.obra.findUnique({ where: { id: datos.obraId } });
  if (!obra) {
    throw new AppError(404, "La obra indicada no existe.");
  }

  const existente = await prisma.seccion.findUnique({
    where: { obraId_nombre: { obraId: datos.obraId, nombre: datos.nombre } },
  });
  if (existente) {
    throw new AppError(409, "Ya existe una sección con ese nombre en esa obra.");
  }

  await verificarHorarioExiste(datos.horarioId);
  await verificarEncargadosValidos(datos.encargadoIds);

  return conManejoDeUnicidad(
    () =>
      prisma.$transaction(async (tx) => {
        const seccion = await tx.seccion.create({
          data: {
            obraId: datos.obraId,
            nombre: datos.nombre,
            horarioId: datos.horarioId ?? null,
            tramoUbicacion: datos.tramoUbicacion ?? null,
            encargados: datos.encargadoIds?.length ? { connect: datos.encargadoIds.map((id) => ({ id })) } : undefined,
          },
        });

        await tx.auditLog.create({
          data: {
            usuarioId: usuarioActorId,
            accion: "crear_seccion",
            entidad: "Seccion",
            entidadId: seccion.id,
            detalle: {
              nombre: seccion.nombre,
              obraId: seccion.obraId,
              tramoUbicacion: seccion.tramoUbicacion,
              encargadoIds: datos.encargadoIds ?? [],
            },
          },
        });

        return seccion;
      }),
    "Ya existe una sección con ese nombre en esa obra."
  );
}

export async function listarSecciones(filtros: { obraId?: string } = {}): Promise<SeccionConEncargados[]> {
  const secciones = await prisma.seccion.findMany({
    where: filtros.obraId ? { obraId: filtros.obraId } : undefined,
    orderBy: { nombre: "asc" },
    include: {
      encargados: { select: { id: true, username: true, trabajadorId: true, trabajador: { select: { nombreCompleto: true, categoria: true } } } },
      responsablesTramo: { select: { id: true, nombreCompleto: true, categoria: true, estatus: true }, orderBy: { nombreCompleto: "asc" } },
      obra: { select: { nombre: true } },
    },
  });
  return secciones.map((seccion) => ({
    ...seccion,
    encargados: seccion.encargados.map((encargado) => ({
      id: encargado.id,
      username: encargado.username,
      trabajadorId: encargado.trabajadorId,
      trabajadorNombre: encargado.trabajador?.nombreCompleto ?? null,
      trabajadorCategoria: encargado.trabajador?.categoria ?? null,
    })),
    responsablesTramo: seccion.responsablesTramo,
  }));
}

export async function listarResponsablesTramo(seccionId: string): Promise<ResponsableTramoBasico[]> {
  const seccion = await prisma.seccion.findUnique({
    where: { id: seccionId },
    include: { responsablesTramo: { select: { id: true, nombreCompleto: true, categoria: true, estatus: true }, orderBy: { nombreCompleto: "asc" } } },
  });
  if (!seccion) throw new AppError(404, "Sección no encontrada.");
  return seccion.responsablesTramo;
}

export async function listarTrabajadoresResponsables(): Promise<ResponsableTramoBasico[]> {
  return prisma.trabajador.findMany({
    where: { estatus: TrabajadorEstatus.activo },
    select: { id: true, nombreCompleto: true, categoria: true, estatus: true },
    orderBy: { nombreCompleto: "asc" },
  });
}

export async function asignarResponsableTramo(usuarioActorId: string, seccionId: string, trabajadorId: string): Promise<ResponsableTramoBasico> {
  return prisma.$transaction(async (tx) => {
    const seccion = await tx.seccion.findUnique({ where: { id: seccionId }, select: { id: true, nombre: true, tramoUbicacion: true } });
    if (!seccion) throw new AppError(404, "Sección no encontrada.");
    const trabajador = await tx.trabajador.findUnique({ where: { id: trabajadorId }, select: { id: true, nombreCompleto: true, categoria: true, estatus: true } });
    if (!trabajador) throw new AppError(404, "Trabajador no encontrado.");
    if (trabajador.estatus !== TrabajadorEstatus.activo) throw new AppError(400, "Solo se pueden asignar trabajadores activos.");
    const yaAsignado = await tx.seccion.findFirst({ where: { id: seccionId, responsablesTramo: { some: { id: trabajadorId } } }, select: { id: true } });
    if (yaAsignado) throw new AppError(409, "El trabajador ya está asignado como responsable de este tramo.");
    await tx.seccion.update({ where: { id: seccionId }, data: { responsablesTramo: { connect: { id: trabajadorId } } } });
    await tx.auditLog.create({ data: { usuarioId: usuarioActorId, accion: "responsable_tramo_asignado", entidad: "Seccion", entidadId: seccionId, detalle: { seccion: seccion.nombre, tramoUbicacion: seccion.tramoUbicacion, trabajadorId, trabajadorNombre: trabajador.nombreCompleto } } });
    return trabajador;
  });
}

export async function retirarResponsableTramo(usuarioActorId: string, seccionId: string, trabajadorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const seccion = await tx.seccion.findUnique({ where: { id: seccionId }, select: { id: true, nombre: true, tramoUbicacion: true, responsablesTramo: { where: { id: trabajadorId }, select: { id: true, nombreCompleto: true } } } });
    if (!seccion) throw new AppError(404, "Sección no encontrada.");
    const responsable = seccion.responsablesTramo[0];
    if (!responsable) throw new AppError(404, "La asignación indicada no existe.");
    await tx.seccion.update({ where: { id: seccionId }, data: { responsablesTramo: { disconnect: { id: trabajadorId } } } });
    await tx.auditLog.create({ data: { usuarioId: usuarioActorId, accion: "responsable_tramo_retirado", entidad: "Seccion", entidadId: seccionId, detalle: { seccion: seccion.nombre, tramoUbicacion: seccion.tramoUbicacion, trabajadorId, trabajadorNombre: responsable.nombreCompleto } } });
  });
}

export async function obtenerSeccion(id: string): Promise<Seccion> {
  const seccion = await prisma.seccion.findUnique({ where: { id } });
  if (!seccion) {
    throw new AppError(404, "Sección no encontrada.");
  }
  return seccion;
}

export async function editarSeccion(
  usuarioActorId: string,
  id: string,
  datos: DatosEdicionSeccion
): Promise<Seccion> {
  const seccion = await prisma.seccion.findUnique({
    where: { id },
    include: { encargados: { select: { id: true } } },
  });
  if (!seccion) {
    throw new AppError(404, "Sección no encontrada.");
  }

  const conflicto = await prisma.seccion.findUnique({
    where: { obraId_nombre: { obraId: seccion.obraId, nombre: datos.nombre } },
  });
  if (conflicto && conflicto.id !== id) {
    throw new AppError(409, "Ya existe una sección con ese nombre en esa obra.");
  }

  await verificarHorarioExiste(datos.horarioId);
  await verificarEncargadosValidos(datos.encargadoIds);

  return conManejoDeUnicidad(
    () =>
      prisma.$transaction(async (tx) => {
        const actualizada = await tx.seccion.update({
          where: { id },
          data: {
            nombre: datos.nombre,
            horarioId: datos.horarioId === undefined ? undefined : datos.horarioId,
            tramoUbicacion: datos.tramoUbicacion === undefined ? undefined : datos.tramoUbicacion,
            encargados: datos.encargadoIds !== undefined ? { set: datos.encargadoIds.map((id) => ({ id })) } : undefined,
          },
        });

        await tx.auditLog.create({
          data: {
            usuarioId: usuarioActorId,
            accion: "editar_seccion",
            entidad: "Seccion",
            entidadId: id,
            detalle: {
              nombre: actualizada.nombre,
              tramoUbicacion: actualizada.tramoUbicacion,
              encargadoIdsAnteriores: seccion.encargados.map((encargado) => encargado.id),
              encargadoIdsNuevos: datos.encargadoIds ?? seccion.encargados.map((encargado) => encargado.id),
            },
          },
        });

        return actualizada;
      }),
    "Ya existe una sección con ese nombre en esa obra."
  );
}

export async function obtenerResumenHoy(
  usuarioId: string,
  rol: RolUsuario,
  seccionId: string
): Promise<ResumenSeccionHoy> {
  await verificarAccesoSeccion(usuarioId, rol, seccionId);
  await obtenerSeccion(seccionId);

  const fecha = hoyEnZonaObra();

  const [asistenciasHoy, asignacionesHoy] = await Promise.all([
    prisma.asistenciaDiaria.findMany({
      where: { seccionId, fecha },
      include: { trabajador: { select: { id: true, nombreCompleto: true } } },
      orderBy: { hora: "asc" },
    }),
    prisma.asignacionDiaria.findMany({
      where: { seccionId, fecha },
      include: { trabajador: { select: { id: true, nombreCompleto: true } } },
    }),
  ]);

  const idsAsignadosEstaSeccion = new Set(asignacionesHoy.map((a) => a.trabajadorId));

  const presentes = asistenciasHoy.map((a) => ({
    trabajadorId: a.trabajador.id,
    nombreCompleto: a.trabajador.nombreCompleto,
    hora: a.hora.toISOString().slice(11, 19),
    asignado: idsAsignadosEstaSeccion.has(a.trabajador.id),
  }));

  if (asignacionesHoy.length === 0) {
    return {
      fecha: fecha.toISOString().slice(0, 10),
      seccionId,
      presentes,
      sinAsignacion: true,
      totalAsignado: null,
      ausentes: null,
    };
  }

  const idsPresentes = new Set(presentes.map((p) => p.trabajadorId));
  const ausentes = asignacionesHoy
    .filter((asignacion) => !idsPresentes.has(asignacion.trabajadorId))
    .map((asignacion) => ({
      trabajadorId: asignacion.trabajador.id,
      nombreCompleto: asignacion.trabajador.nombreCompleto,
    }));

  return {
    fecha: fecha.toISOString().slice(0, 10),
    seccionId,
    presentes,
    sinAsignacion: false,
    totalAsignado: asignacionesHoy.length,
    ausentes,
  };
}

export async function borrarSeccion(usuarioActorId: string, id: string): Promise<void> {
  const seccion = await obtenerSeccion(id);

  const [enUsoAsistencias, enUsoAsignaciones, encargadosAsignados] = await Promise.all([
    prisma.asistenciaDiaria.count({ where: { seccionId: id } }),
    prisma.asignacionDiaria.count({ where: { seccionId: id } }),
    prisma.usuario.count({ where: { seccionesAsignadas: { some: { id } } } }),
  ]);

  if (enUsoAsistencias > 0 || enUsoAsignaciones > 0 || encargadosAsignados > 0) {
    throw new AppError(
      409,
      "No se puede borrar: la sección está en uso (tiene asistencias, asignaciones diarias o encargados asignados)."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.seccion.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "borrar_seccion",
        entidad: "Seccion",
        entidadId: id,
        detalle: { nombre: seccion.nombre },
      },
    });
  });
}

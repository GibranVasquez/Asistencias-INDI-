import { AsistenciaDiaria, MetodoAsistencia, Prisma, RolUsuario, TrabajadorEstatus, TipoMarcacion } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { verificarAccesoSeccion } from "../utils/accesoSeccion";

// Denormaliza trabajadorNombre/seccionNombre directo en la respuesta de
// listarAsistencias: recepcion puede leer /asistencias pero NO
// /trabajadores ni /secciones (ambos rol=rh), asi que sin esto el listado
// solo tendria UUIDs — inutilizable para la pantalla que es literalmente
// la razon de ser de ese rol. Evita ademas tener que ampliarle a recepcion
// el acceso a esos catalogos completos (categoria, jefeInmediato, etc.)
// solo para resolver un nombre.
export interface AsistenciaListada extends Omit<AsistenciaDiaria, "obraId"> {
  obraId: string;
  trabajadorNombre: string;
  seccionNombre: string;
  trabajadorCategoria: string;
  trabajadorHuellaRegistrada: boolean;
  seccionTramoUbicacion: string | null;
  seccionResponsables: { id: string; nombreCompleto: string; categoria: string }[];
  obraNombre: string;
  horarioNombre: string | null;
}

export interface DatosRegistroAsistencia {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM o HH:MM:SS
  /** Frente diario; null es válido únicamente para marcaciones ADMS sin planeación. */
  seccionId: string | null;
  /** Contexto de Obra validado por el punto de captura. */
  obraId?: string | null;
  turno: string;
  metodoUsado: MetodoAsistencia;
  tipoMarcacion?: TipoMarcacion | null;
  punchCrudo?: number | null;
  ubicacionGPS?: string | null;
}

export interface FiltrosAsistencia {
  fecha?: string; // YYYY-MM-DD, coincidencia exacta
  fechaInicio?: string; // YYYY-MM-DD, usado junto con fechaFin si fecha no se envía
  fechaFin?: string;
  seccionId?: string;
  trabajadorId?: string;
  turno?: string;
  categoria?: string;
}

const RELACIONES_ASISTENCIA = {
  trabajador: { select: { nombreCompleto: true, categoria: true, huellaRegistrada: true } },
  obra: { select: { nombre: true } },
  seccion: {
    select: {
      nombre: true,
      tramoUbicacion: true,
      responsablesTramo: {
        where: { estatus: TrabajadorEstatus.activo },
        select: { id: true, nombreCompleto: true, categoria: true },
      },
      horario: { select: { nombre: true } },
    },
  },
} satisfies Prisma.AsistenciaDiariaInclude;

type AsistenciaConRelaciones = Prisma.AsistenciaDiariaGetPayload<{
  include: typeof RELACIONES_ASISTENCIA;
}>;

function aAsistenciaListada({ trabajador, obra, seccion, ...resto }: AsistenciaConRelaciones): AsistenciaListada {
  if (!obra) throw new AppError(500, "Asistencia sin Obra: integridad inesperada.");
  return {
    ...resto,
    obraId: resto.obraId!,
    trabajadorNombre: trabajador.nombreCompleto,
    trabajadorCategoria: trabajador.categoria,
    trabajadorHuellaRegistrada: trabajador.huellaRegistrada,
    seccionNombre: seccion?.nombre ?? "Sin asignación",
    seccionTramoUbicacion: seccion?.tramoUbicacion ?? null,
    seccionResponsables: seccion?.responsablesTramo ?? [],
    obraNombre: obra.nombre,
    horarioNombre: seccion?.horario?.nombre ?? null,
  };
}

function normalizarHora(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora;
}

function aFechaUTC(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00Z`);
}

export async function registrarAsistencia(
  trabajadorId: string,
  terminalOrigenId: string,
  datos: DatosRegistroAsistencia
): Promise<AsistenciaDiaria> {
  const trabajador = await prisma.trabajador.findUnique({ where: { id: trabajadorId } });

  if (!trabajador) {
    throw new AppError(404, "Trabajador no encontrado.");
  }

  if (trabajador.estatus !== TrabajadorEstatus.activo) {
    throw new AppError(403, "El trabajador no está activo.");
  }

  // La terminal es el punto de captura y la única fuente de contexto de Obra:
  // una asistencia nueva nunca puede inventar una Obra a partir del catálogo.
  const terminal = await prisma.terminal.findUnique({ where: { id: terminalOrigenId }, select: { activo: true, obraId: true } });
  if (!terminal || !terminal.activo) {
    throw new AppError(403, "La terminal no está autorizada.");
  }
  const obraId = terminal.obraId;
  if (!obraId) throw new AppError(403, "La terminal no tiene una Obra asignada.");
  if (datos.obraId && datos.obraId !== obraId) throw new AppError(403, "La Obra indicada no coincide con la terminal.");

  if (datos.seccionId) {
    const seccion = await prisma.seccion.findUnique({ where: { id: datos.seccionId }, select: { obraId: true } });
    if (!seccion) throw new AppError(400, "La sección indicada no existe.");
    if (seccion.obraId !== obraId) throw new AppError(403, "La terminal y el Frente pertenecen a Obras distintas.");
  }

  const fecha = aFechaUTC(datos.fecha);
  const hora = new Date(`1970-01-01T${normalizarHora(datos.hora)}Z`);

  try {
    return await prisma.asistenciaDiaria.create({
      data: {
        trabajadorId,
        obraId,
        fecha,
        hora,
        seccionId: datos.seccionId,
        turno: datos.turno,
        metodoUsado: datos.metodoUsado,
        tipoMarcacion: datos.tipoMarcacion ?? null,
        punchCrudo: datos.punchCrudo ?? null,
        terminalOrigenId,
        ubicacionGPS: datos.ubicacionGPS ?? null,
      },
    });
  } catch (error) {
    // El mismo trabajador+terminal+fecha+hora ya existe (restricción única
    // uq_asistencias_trabajador_terminal_fecha_hora) — un reintento de red
    // del Kiosco, un reenvío de backlog de ADMS, o un doble tap accidental
    // dentro del mismo minuto (el Kiosco solo manda HH:MM, sin segundos).
    // No es un error real: se devuelve el registro ya existente en vez de
    // fallar, para que quien reintenta reciba la misma confirmación de
    // éxito — no tiene sentido mostrarle un error a un trabajador parado
    // frente al kiosco por algo que técnicamente ya se registró bien.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existente = await prisma.asistenciaDiaria.findFirst({
        where: { trabajadorId, terminalOrigenId, fecha, hora },
      });
      if (existente) return existente;
    }
    throw error;
  }
}

/**
 * Para la pantalla de confirmación del Kiosco (modo ADMS, ver
 * KioscoPage.tsx): hace polling de "¿hubo una marcación nueva del lector
 * ADMS?". NO se filtra por el terminalId de quien pregunta (el Kiosco que
 * hace polling) — la marcación real la registra el equipo ADMS físico
 * (un Terminal tipo="adms" *distinto* al Kiosco que la muestra), así que
 * filtrar por el terminalId del propio Kiosco nunca encontraría nada.
 * Se filtra por tipo="adms" en su lugar: correcto mientras haya un solo
 * lector ADMS de oficina (el caso real hoy) — si algún día hay más de
 * uno, esto necesitaría un vínculo explícito Kiosco↔lector, no solo
 * "cualquier ADMS".
 */
export async function obtenerAsistenciaMasRecienteDeTerminal(): Promise<AsistenciaListada | null> {
  const registro = await prisma.asistenciaDiaria.findFirst({
    where: { terminalOrigen: { tipo: "adms" } },
    include: RELACIONES_ASISTENCIA,
    orderBy: { creadoEn: "desc" },
  });

  if (!registro) return null;

  return aAsistenciaListada(registro);
}

/**
 * encargado_seccion no tiene un scoping implicito como rh (que ve todo) —
 * debe mandar un seccionId, y tiene que ser una de las suyas
 * (verificarAccesoSeccion), sin importar que mas venga en el filtro. Sin
 * esto, cualquier encargado podria leer asistencias de OTRA seccion con
 * solo cambiar el query param.
 */
export async function listarAsistencias(
  usuarioId: string,
  rol: RolUsuario,
  filtros: FiltrosAsistencia
): Promise<AsistenciaListada[]> {
  if (rol === RolUsuario.encargado_seccion) {
    if (!filtros.seccionId) {
      throw new AppError(400, "seccionId es requerido para tu rol.");
    }
    await verificarAccesoSeccion(usuarioId, rol, filtros.seccionId);
  }

  const filtroFecha = filtros.fecha
    ? aFechaUTC(filtros.fecha)
    : filtros.fechaInicio || filtros.fechaFin
      ? {
          ...(filtros.fechaInicio ? { gte: aFechaUTC(filtros.fechaInicio) } : {}),
          ...(filtros.fechaFin ? { lte: aFechaUTC(filtros.fechaFin) } : {}),
        }
      : undefined;

  const registros = await prisma.asistenciaDiaria.findMany({
    where: {
      ...(filtroFecha ? { fecha: filtroFecha } : {}),
      ...(filtros.seccionId ? { seccionId: filtros.seccionId } : {}),
      ...(filtros.trabajadorId ? { trabajadorId: filtros.trabajadorId } : {}),
      ...(filtros.turno ? { turno: filtros.turno } : {}),
      ...(filtros.categoria ? { trabajador: { categoria: filtros.categoria } } : {}),
    },
    include: RELACIONES_ASISTENCIA,
    orderBy: [{ fecha: "desc" }, { hora: "desc" }],
  });

  return registros.map(aAsistenciaListada);
}

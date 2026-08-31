import { MetodoAsistencia, Prisma, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";

export interface DatosReconciliacion {
  trabajadorId: string;
  seccionId: string;
}

export type ResultadoReconciliacion = "reconciliado" | "ya_existia" | "ya_reconciliado";

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

function fechaCivil(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function horaCivil(hora: Date): string {
  return hora.toISOString().slice(11, 19);
}

function metodoDesdeVerify(metodoCrudo: string): MetodoAsistencia {
  return metodoCrudo.trim() === "15" ? MetodoAsistencia.rostro : MetodoAsistencia.huella;
}

function errorValidacion(mensaje: string): never {
  throw new AppError(422, mensaje);
}

export async function reconciliarEventoAdms(
  actorId: string,
  eventoId: string,
  datos: DatosReconciliacion
): Promise<{ resultado: ResultadoReconciliacion; evento: { id: string; asistenciaId: string; reconciliadoEn: Date; reconciliadoPorId: string }; asistencia: unknown }> {
  if (!esUuid(eventoId) || !esUuid(datos.trabajadorId) || !esUuid(datos.seccionId)) {
    throw new AppError(400, "eventoId, trabajadorId y seccionId deben ser UUID válidos.");
  }

  return prisma.$transaction(async (tx) => {
    // El lock serializa dos decisiones concurrentes sobre el mismo evento.
    const bloqueado = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "eventos_no_reconciliados" WHERE id = ${eventoId}::uuid FOR UPDATE
    `;
    if (bloqueado.length === 0) throw new AppError(404, "Evento no reconciliado no encontrado.");

    const evento = await tx.eventoNoReconciliado.findUnique({
      where: { id: eventoId },
      include: { asistencia: { select: { id: true, trabajadorId: true, seccionId: true } } },
    });
    if (!evento) throw new AppError(404, "Evento no reconciliado no encontrado.");

    if (evento.asistencia) {
      if (evento.asistencia.trabajadorId !== datos.trabajadorId || evento.asistencia.seccionId !== datos.seccionId) {
        throw new AppError(409, "El evento ya fue reconciliado hacia otro trabajador o sección.");
      }
      const reconciliadoEn = evento.reconciliadoEn ?? evento.creadoEn;
      const reconciliadoPorId = evento.reconciliadoPorId ?? actorId;
      return {
        resultado: "ya_reconciliado",
        evento: { id: evento.id, asistenciaId: evento.asistencia.id, reconciliadoEn, reconciliadoPorId },
        asistencia: evento.asistencia,
      };
    }

    if (!evento.fechaMarcacion || !evento.horaMarcacion) {
      errorValidacion("El evento no tiene fecha y hora civiles; requiere revisión especial.");
    }

    if (!evento.obraId) {
      errorValidacion("El evento no tiene una Obra de origen configurada; requiere revisión especial.");
    }

    const pinTexto = evento.pinDispositivo.trim();
    const pinNumerico = Number(pinTexto);
    if (!pinTexto || !Number.isInteger(pinNumerico) || pinNumerico < 0) {
      errorValidacion("El PIN del evento no es numérico; requiere revisión especial.");
    }

    const [trabajador, seccion, terminal] = await Promise.all([
      tx.trabajador.findUnique({ where: { id: datos.trabajadorId }, select: { id: true, estatus: true, numeroChecador: true } }),
      tx.seccion.findUnique({ where: { id: datos.seccionId }, select: { id: true, obraId: true } }),
      tx.terminal.findUnique({ where: { id: evento.terminalId }, select: { id: true } }),
    ]);
    if (!trabajador) throw new AppError(404, "Trabajador no encontrado.");
    if (!seccion) throw new AppError(404, "Sección no encontrada.");
    if (!terminal) throw new AppError(404, "Terminal de origen no encontrada.");
    if (seccion.obraId !== evento.obraId) errorValidacion("El Frente seleccionado no pertenece a la Obra de origen de la incidencia.");
    if (trabajador.estatus !== TrabajadorEstatus.activo) errorValidacion("El trabajador no está activo; requiere revisión especial.");
    if (trabajador.numeroChecador == null || trabajador.numeroChecador !== pinNumerico) {
      errorValidacion("El número de checador no coincide con el PIN del evento.");
    }

    const fecha = evento.fechaMarcacion;
    const hora = evento.horaMarcacion;
    const fechaTexto = fechaCivil(fecha);
    const horaTexto = horaCivil(hora);
    const asistenciaData = {
      trabajadorId: trabajador.id,
      terminalOrigenId: terminal.id,
      obraId: evento.obraId,
      fecha,
      hora,
      seccionId: seccion.id,
      turno: "Oficina",
      metodoUsado: metodoDesdeVerify(evento.metodoCrudo),
      ubicacionGPS: null,
    } satisfies Prisma.AsistenciaDiariaCreateManyInput;

    const creada = await tx.asistenciaDiaria.createMany({ data: [asistenciaData], skipDuplicates: true });
    const asistencia = await tx.asistenciaDiaria.findFirstOrThrow({
      where: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, fecha, hora },
    });
    if (asistencia.seccionId !== seccion.id) {
      throw new AppError(409, "La asistencia exacta existente pertenece a otra sección.");
    }
    const resultado: ResultadoReconciliacion = creada.count === 1 ? "reconciliado" : "ya_existia";
    const reconciliadoEn = new Date();
    await tx.eventoNoReconciliado.update({
      where: { id: evento.id },
      data: { asistenciaId: asistencia.id, reconciliadoEn, reconciliadoPorId: actorId },
    });
    await tx.auditLog.create({
      data: {
        usuarioId: actorId,
        accion: "reconciliar_evento_adms",
        entidad: "EventoNoReconciliado",
        entidadId: evento.id,
        detalle: {
          eventoId: evento.id,
          pinDispositivo: evento.pinDispositivo,
          trabajadorId: trabajador.id,
          asistenciaId: asistencia.id,
          terminalId: terminal.id,
          seccionId: seccion.id,
          fechaMarcacion: fechaTexto,
          horaMarcacion: horaTexto,
          resultado: resultado === "reconciliado" ? "CREADA" : "YA_EXISTIA",
        },
      },
    });
    return {
      resultado,
      evento: { id: evento.id, asistenciaId: asistencia.id, reconciliadoEn, reconciliadoPorId: actorId },
      asistencia,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

import { MetodoAsistencia, Terminal, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { registrarAsistencia } from "./asistencia.service";

// El dispositivo ADMS solo aporta el punto de captura. La sección/Frente de
// una asistencia se toma de la asignación diaria del trabajador; nunca se
// infiere por la ubicación o el nombre de la terminal (incluida "Oficina").
const TURNO_OFICINA = "Oficina";

// Mapeo verify-code -> MetodoAsistencia. 1=huella y 15=rostro son los
// valores más citados en la documentación/reversing del protocolo ADMS,
// pero NINGUNA fuente es un spec oficial público de ZKTeco — varían por
// modelo/firmware. No validado todavía contra el MB10-VL real. Si un
// código no está aquí, se guarda igual el crudo (ver
// EventoNoReconciliado.metodoCrudo más abajo) para poder ampliar este
// mapa con datos reales en vez de adivinar.
const MAPA_METODO_VERIFY: Record<string, MetodoAsistencia> = {
  "1": MetodoAsistencia.huella,
  "15": MetodoAsistencia.rostro,
};

export interface RegistroAttlog {
  pin: string;
  fechaCivil: string;
  horaCivil: string;
  /** Representación técnica UTC únicamente para EventoNoReconciliado.marcadoEn. */
  fechaHora: Date;
  metodoVerifyCrudo: string;
}

export interface FechaHoraCivilAdms {
  fechaCivil: string;
  horaCivil: string;
}

/** Valida y separa el formato civil exacto que entrega ATTLOG. */
export function parseFechaHoraCivilAdms(valor: string): FechaHoraCivilAdms | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(valor);
  if (!coincidencia) return null;
  const [, anioTexto, mesTexto, diaTexto, horaTexto, minutoTexto, segundoTexto] = coincidencia;
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  const segundo = Number(segundoTexto);
  if (mes < 1 || mes > 12 || hora > 23 || minuto > 59 || segundo > 59) return null;
  const calendario = new Date(Date.UTC(anio, mes - 1, dia));
  if (calendario.getUTCFullYear() !== anio || calendario.getUTCMonth() !== mes - 1 || calendario.getUTCDate() !== dia) return null;
  return { fechaCivil: `${anioTexto}-${mesTexto}-${diaTexto}`, horaCivil: `${horaTexto}:${minutoTexto}:${segundoTexto}` };
}

/** Codificación técnica de DATE; no representa un instante de negocio. */
export function fechaCivilAFechaPrisma(fechaCivil: string): Date {
  return new Date(`${fechaCivil}T00:00:00.000Z`);
}

/** Codificación técnica de TIME; no representa una hora UTC de negocio. */
export function horaCivilAHoraPrisma(horaCivil: string): Date {
  return new Date(`1970-01-01T${horaCivil}Z`);
}

/** Solo para el campo histórico TIMESTAMPTZ de EventoNoReconciliado. */
function fechaHoraCivilATimestampTecnico({ fechaCivil, horaCivil }: FechaHoraCivilAdms): Date {
  return new Date(`${fechaCivil}T${horaCivil}Z`);
}

/**
 * Una línea ATTLOG es tab-separated: PIN, fecha-hora, status, verify,
 * workcode, reservado, reservado (el orden exacto y la cantidad de campos
 * reservados varía por firmware — solo los primeros 4 importan aquí).
 * `status` (el 3er campo — entrada/salida/etc.) no se usa: este sistema ya
 * calcula puntualidad/tardanza a partir de sección+horario, no de lo que
 * el equipo interprete como "tipo" de marcación.
 */
export function parsearLineaAttlog(linea: string): RegistroAttlog | null {
  const campos = linea.split("\t");
  if (campos.length < 4) return null;

  const [pin, fechaHoraTexto, , verify] = campos;
  if (!pin?.trim() || !fechaHoraTexto?.trim()) return null;

  const civil = parseFechaHoraCivilAdms(fechaHoraTexto.trim());
  if (!civil) return null;
  return { pin: pin.trim(), ...civil, fechaHora: fechaHoraCivilATimestampTecnico(civil), metodoVerifyCrudo: verify?.trim() ?? "" };
}

export async function resolverTerminalPorSN(sn: string | undefined): Promise<Terminal> {
  if (!sn) {
    throw new AppError(400, "SN es requerido.");
  }

  // El SN viaja en texto plano y es trivialmente falsificable — esto NO es
  // autenticación real, solo confirma "es un equipo que nosotros dimos de
  // alta". La protección real es de red (ver CLAUDE.md): este endpoint no
  // debería ser alcanzable fuera de la LAN de oficina donde vive el MB10-VL.
  const terminal = await prisma.terminal.findUnique({ where: { numeroSerie: sn } });
  if (!terminal || !terminal.activo) {
    throw new AppError(403, "Terminal no reconocido o inactivo.");
  }

  return terminal;
}

async function obtenerSeccionAsignadaId(trabajadorId: string, fechaCivil: string, obraId: string | null | undefined): Promise<string | null> {
  const asignacion = await prisma.asignacionDiaria.findUnique({
    where: { trabajadorId_fecha: { trabajadorId, fecha: fechaCivilAFechaPrisma(fechaCivil) } },
    include: { seccion: { select: { id: true, obraId: true } } },
  });
  if (!asignacion || (obraId && asignacion.seccion.obraId !== obraId)) return null;
  return asignacion.seccion.id;
}

async function yaExisteAsistencia(trabajadorId: string, terminalId: string, fechaCivil: string, horaCivil: string): Promise<boolean> {
  // Guarda contra duplicados si el equipo reenvía el mismo lote (el
  // protocolo espera que el servidor recuerde el último "Stamp" recibido
  // por terminal para no pedir de nuevo el mismo backlog — no
  // implementado todavía, ver CLAUDE.md). Sin esto, una reconexión del
  // equipo podría crear la misma AsistenciaDiaria dos veces.
  const existente = await prisma.asistenciaDiaria.findFirst({
    where: {
      trabajadorId,
      terminalOrigenId: terminalId,
      fecha: fechaCivilAFechaPrisma(fechaCivil),
      hora: horaCivilAHoraPrisma(horaCivil),
    },
  });
  return existente !== null;
}

async function yaExisteEventoNoReconciliado(terminalId: string, registro: RegistroAttlog): Promise<boolean> {
  // Mismo motivo que yaExisteAsistencia: si el equipo reenvía un PIN que
  // sigue sin reconciliarse (RH todavía no le asigna numeroChecador a
  // nadie), cada reconexión repetiría la MISMA marcación sin resolver —
  // sin este guard, se acumularía un EventoNoReconciliado nuevo por cada
  // reenvío del mismo evento, en vez de uno solo por evento real.
  const existente = await prisma.eventoNoReconciliado.findFirst({
    where: { terminalId, pinDispositivo: registro.pin, marcadoEn: registro.fechaHora },
  });
  return existente !== null;
}

async function registrarEventoNoReconciliado(
  terminalId: string,
  obraId: string | null,
  registro: RegistroAttlog
): Promise<void> {
  await prisma.eventoNoReconciliado.create({
    data: {
      terminalId,
      obraId,
      pinDispositivo: registro.pin,
      fechaMarcacion: fechaCivilAFechaPrisma(registro.fechaCivil),
      horaMarcacion: horaCivilAHoraPrisma(registro.horaCivil),
      marcadoEn: registro.fechaHora,
      metodoCrudo: registro.metodoVerifyCrudo,
    },
  });
}

export interface ResultadoProcesamientoAttlog {
  procesados: number;
  duplicados: number;
  noReconciliados: number;
}

export async function procesarLoteAttlog(terminal: Terminal, cuerpoCrudo: string): Promise<ResultadoProcesamientoAttlog> {
  const lineas = cuerpoCrudo
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let procesados = 0;
  let duplicados = 0;
  let noReconciliados = 0;

  for (const linea of lineas) {
    const registro = parsearLineaAttlog(linea);
    if (!registro) continue; // línea malformada — no es un evento real que reconciliar, no de un trabajador

    const pinNumerico = Number(registro.pin);
    const trabajador = Number.isInteger(pinNumerico)
      ? await prisma.trabajador.findUnique({ where: { numeroChecador: pinNumerico } })
      : null;

    if (!trabajador || trabajador.estatus !== TrabajadorEstatus.activo) {
      if (await yaExisteEventoNoReconciliado(terminal.id, registro)) {
        duplicados++;
        continue;
      }
      await registrarEventoNoReconciliado(terminal.id, terminal.obraId ?? null, registro);
      noReconciliados++;
      continue;
    }

    // Chequeo de aplicación para el caso comun (backlog reenviado
    // secuencialmente, ya verificado en vivo — ver CLAUDE.md). Para el
    // caso realmente concurrente (dos POST /iclock/cdata superpuestos),
    // registrarAsistencia tiene su propio respaldo real via la restricción
    // única de la base y devuelve el registro existente en silencio en vez
    // de fallar — ese caso raro se cuenta como "procesados", no
    // "duplicados", pero no crea una fila repetida, que es lo que importa.
    if (await yaExisteAsistencia(trabajador.id, terminal.id, registro.fechaCivil, registro.horaCivil)) {
      duplicados++;
      continue;
    }

    const seccionId = await obtenerSeccionAsignadaId(trabajador.id, registro.fechaCivil, terminal.obraId);
    if (!seccionId) {
      // El trabajador es conocido, pero no existe una asignación diaria
      // inequívoca dentro de la Obra del dispositivo. Se conserva el evento
      // para revisión posterior en vez de inventar un Frente "Oficina".
      await registrarEventoNoReconciliado(terminal.id, terminal.obraId ?? null, registro);
      noReconciliados++;
      continue;
    }
    // Fallback a huella si el código no está en el mapa: MetodoAsistencia es
    // un enum de solo 2 valores, así que algo hay que elegir — se prefiere
    // no perder la asistencia (ya sabemos QUIÉN es) por un código de verify
    // que el mapa no cubre todavía. El crudo queda visible en el warning de
    // servidor para poder ampliar MAPA_METODO_VERIFY con datos reales.
    const metodoUsado = MAPA_METODO_VERIFY[registro.metodoVerifyCrudo];
    if (!metodoUsado) {
      console.warn(
        `[adms] código de verificación desconocido "${registro.metodoVerifyCrudo}" (terminal ${terminal.id}, PIN ${registro.pin}) — usando "huella" por default.`
      );
    }

    await registrarAsistencia(trabajador.id, terminal.id, {
      fecha: registro.fechaCivil,
      hora: registro.horaCivil,
      seccionId,
      turno: TURNO_OFICINA,
      metodoUsado: metodoUsado ?? MetodoAsistencia.huella,
    });
    procesados++;
  }

  return { procesados, duplicados, noReconciliados };
}

// Respuesta del handshake GET /iclock/cdata?options=all. Los nombres de
// campo (ATTLOGStamp/OPERLOGStamp/etc.) son los más citados entre varias
// implementaciones de terceros que revisé — el protocolo real de ZKTeco no
// tiene spec pública oficial. Responder siempre "None" en los Stamp le
// dice al equipo "no he recibido nada todavía": correcto para un equipo
// nuevo, pero si en producción el equipo reconecta seguido, podría
// reenviar todo su backlog cada vez.
//
// Esto NO genera duplicados ni pierde datos: yaExisteAsistencia (abajo) y
// yaExisteEventoNoReconciliado detectan y descartan exactamente los mismos
// PIN+fecha+hora ya procesados, sin importar cuántas veces se reenvíen —
// verificado reenviando el mismo lote ATTLOG dos veces (ver CLAUDE.md,
// sección ADMS). Lo único que esto NO evita es procesamiento redundante:
// si el equipo de verdad reenvía un backlog grande en cada reconexión, cada
// línea igual se vuelve a parsear y buscar en BD para confirmar que ya
// existe — un costo de eficiencia, no un hueco de integridad de datos.
// Persistir el último Stamp real por terminal (para que el equipo sepa que
// no hace falta reenviar nada) evitaría ese costo, pero es una optimización
// pendiente, no una corrección de un bug.
export function generarRespuestaHandshake(sn: string): string {
  return [
    `GET OPTION FROM:${sn}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=None",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=30",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog",
    "Realtime=1",
    "Encrypt=None",
  ].join("\n");
}

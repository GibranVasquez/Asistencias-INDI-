import { MetodoAsistencia, Terminal, TrabajadorEstatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { registrarAsistencia } from "./asistencia.service";

// Sección/turno fijos para todo lo que llegue de un terminal tipo="adms":
// el lector de oficina (ZKTeco MB10-VL) es de un solo punto físico, no
// requiere que el equipo indique sección — confirmado con el usuario
// 2026-07-25. "Oficina" (turno) replica la convención ya usada en el
// Kiosco manual, donde turno = nombre del Horario (ver KioscoPage.tsx).
const SECCION_OFICINA_NOMBRE = "Oficina";
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
  fechaHora: Date;
  metodoVerifyCrudo: string;
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

  // "YYYY-MM-DD HH:MM:SS" — se trata como hora LOCAL de la oficina, igual
  // que el resto del sistema (ver asistencia.service.ts: la hora se
  // guarda tal cual, sin conversión real de zona horaria — el servidor
  // debe correr en la zona horaria real de la obra). El "Z" es solo el
  // truco para construir un Date sin que el motor de JS le reste su propio
  // huso horario local.
  const fechaHora = new Date(`${fechaHoraTexto.trim().replace(" ", "T")}Z`);
  if (Number.isNaN(fechaHora.getTime())) return null;

  return { pin: pin.trim(), fechaHora, metodoVerifyCrudo: verify?.trim() ?? "" };
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

async function obtenerSeccionOficinaId(): Promise<string> {
  const seccion = await prisma.seccion.findFirst({ where: { nombre: SECCION_OFICINA_NOMBRE } });
  if (!seccion) {
    // No debería pasar (la sección se siembra en prisma/seed.ts), pero si
    // alguien la borra manualmente, mejor un error claro que una asistencia
    // huérfana o un crash distinto más abajo.
    throw new AppError(500, `No existe la sección "${SECCION_OFICINA_NOMBRE}" — revisa el seed.`);
  }
  return seccion.id;
}

function aFechaSolo(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

function aHoraSolo(fecha: Date): Date {
  return new Date(
    Date.UTC(1970, 0, 1, fecha.getUTCHours(), fecha.getUTCMinutes(), fecha.getUTCSeconds())
  );
}

async function yaExisteAsistencia(trabajadorId: string, terminalId: string, marcadoEn: Date): Promise<boolean> {
  // Guarda contra duplicados si el equipo reenvía el mismo lote (el
  // protocolo espera que el servidor recuerde el último "Stamp" recibido
  // por terminal para no pedir de nuevo el mismo backlog — no
  // implementado todavía, ver CLAUDE.md). Sin esto, una reconexión del
  // equipo podría crear la misma AsistenciaDiaria dos veces.
  const existente = await prisma.asistenciaDiaria.findFirst({
    where: {
      trabajadorId,
      terminalOrigenId: terminalId,
      fecha: aFechaSolo(marcadoEn),
      hora: aHoraSolo(marcadoEn),
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
  registro: RegistroAttlog
): Promise<void> {
  await prisma.eventoNoReconciliado.create({
    data: {
      terminalId,
      pinDispositivo: registro.pin,
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
      await registrarEventoNoReconciliado(terminal.id, registro);
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
    if (await yaExisteAsistencia(trabajador.id, terminal.id, registro.fechaHora)) {
      duplicados++;
      continue;
    }

    const seccionId = await obtenerSeccionOficinaId();
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

    const fechaISO = registro.fechaHora.toISOString().slice(0, 10);
    const horaISO = registro.fechaHora.toISOString().slice(11, 19);

    await registrarAsistencia(trabajador.id, terminal.id, {
      fecha: fechaISO,
      hora: horaISO,
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

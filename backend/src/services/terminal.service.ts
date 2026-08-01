import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarTerminal, TerminalPublico } from "../utils/terminalSerializer";

const RONDAS_BCRYPT = 10;
// Bytes de entropía (antes de base64) para la password autogenerada de un
// terminal tipo="adms" — ver crearTerminal.
const BYTES_PASSWORD_GENERADA_ADMS = 32;

export interface DatosAltaTerminal {
  username: string;
  // No requerida para tipo="adms": terminalAuth.service.ts rechaza login
  // para ese tipo sin importar la password, así que no tiene sentido
  // pedirle a un administrador que escriba una a mano - se genera aquí.
  password?: string;
  tipo: string;
  ubicacion: string;
  numeroSerie?: string | null;
}

// tipo no es editable a proposito (la naturaleza del dispositivo no deberia
// cambiar despues del alta) — ni username/password (un Kiosco real no
// necesita reseteo de credencial documentado hoy, y un tipo="adms" nunca
// usa su password para nada, ver crearTerminal).
export interface DatosEdicionTerminal {
  ubicacion?: string;
  numeroSerie?: string | null;
  activo?: boolean;
}

export async function listarTerminales(): Promise<TerminalPublico[]> {
  const terminales = await prisma.terminal.findMany({ orderBy: { ubicacion: "asc" } });
  return terminales.map(serializarTerminal);
}

export async function crearTerminal(usuarioCreadorId: string, datos: DatosAltaTerminal): Promise<TerminalPublico> {
  const existente = await prisma.terminal.findUnique({ where: { username: datos.username } });
  if (existente) {
    throw new AppError(409, "Ya existe un terminal con ese username.");
  }

  if (datos.numeroSerie) {
    const conNumeroSerie = await prisma.terminal.findUnique({ where: { numeroSerie: datos.numeroSerie } });
    if (conNumeroSerie) {
      throw new AppError(409, "Ya existe un terminal dado de alta con ese número de serie.");
    }
  }

  // tipo="adms" nunca puede iniciar sesión (ver terminalAuth.service.ts,
  // rechaza ese tipo explícitamente) - su password nunca se usa para nada
  // real, así que se genera aleatoria aquí mismo en vez de aceptar una que
  // un administrador escriba a mano. No se expone en ningún lado: no viaja
  // de vuelta en la respuesta (TerminalPublico no incluye password/hash) ni
  // se loguea.
  const password = datos.tipo === "adms" ? randomBytes(BYTES_PASSWORD_GENERADA_ADMS).toString("base64") : datos.password;
  if (!password) {
    throw new AppError(400, "password es requerido.");
  }

  const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);

  const terminal = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.terminal.create({
      data: {
        username: datos.username,
        passwordHash,
        tipo: datos.tipo,
        ubicacion: datos.ubicacion,
        numeroSerie: datos.numeroSerie ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioCreadorId,
        accion: "crear_terminal",
        entidad: "Terminal",
        entidadId: nuevo.id,
        detalle: { username: nuevo.username, tipo: nuevo.tipo, ubicacion: nuevo.ubicacion },
      },
    });

    return nuevo;
  });

  return serializarTerminal(terminal);
}

async function verificarNumeroSerieDisponible(numeroSerie: string | null | undefined, idAExcluir: string): Promise<void> {
  if (!numeroSerie) return;
  const existente = await prisma.terminal.findUnique({ where: { numeroSerie } });
  if (existente && existente.id !== idAExcluir) {
    throw new AppError(409, "Ya existe otro terminal dado de alta con ese número de serie.");
  }
}

export async function editarTerminal(
  usuarioActorId: string,
  id: string,
  datos: DatosEdicionTerminal
): Promise<TerminalPublico> {
  const actual = await prisma.terminal.findUnique({ where: { id } });
  if (!actual) {
    throw new AppError(404, "Terminal no encontrado.");
  }

  await verificarNumeroSerieDisponible(datos.numeroSerie, id);

  const data: Prisma.TerminalUpdateInput = {};
  if (datos.ubicacion !== undefined) data.ubicacion = datos.ubicacion;
  if (datos.numeroSerie !== undefined) data.numeroSerie = datos.numeroSerie;
  if (datos.activo !== undefined) data.activo = datos.activo;

  const camposEditados = Object.keys(datos).filter((k) => (datos as Record<string, unknown>)[k] !== undefined);

  const terminal = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.terminal.update({ where: { id }, data });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: "editar_terminal",
        entidad: "Terminal",
        entidadId: id,
        detalle: { camposEditados },
      },
    });

    return actualizado;
  });

  return serializarTerminal(terminal);
}

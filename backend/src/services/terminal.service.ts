import bcrypt from "bcrypt";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarTerminal, TerminalPublico } from "../utils/terminalSerializer";

const RONDAS_BCRYPT = 10;

export interface DatosAltaTerminal {
  username: string;
  password: string;
  tipo: string;
  ubicacion: string;
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

  const passwordHash = await bcrypt.hash(datos.password, RONDAS_BCRYPT);

  const terminal = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.terminal.create({
      data: {
        username: datos.username,
        passwordHash,
        tipo: datos.tipo,
        ubicacion: datos.ubicacion,
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

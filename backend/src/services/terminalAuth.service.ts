import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Terminal } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarTerminal, TerminalPublico } from "../utils/terminalSerializer";

const MENSAJE_CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos.";
const MENSAJE_TERMINAL_DESACTIVADO = "Este terminal está desactivado. Contacta a un administrador.";

// Mismo propósito que el señuelo de auth.service.ts: comparar contra un hash
// real aunque el username no exista, para no filtrar por timing si el
// terminal existe.
const HASH_SENUELO = "$2b$10$Kub8YdpWySlJS5Itfm4ku.piTu3HZ.mdUtfP1e4z28Rd/fW3p3IHK";

export interface ResultadoLoginTerminal {
  token: string;
  terminal: TerminalPublico;
}

function firmarTokenTerminal(terminal: Terminal): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está configurado");
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"];

  return jwt.sign({ terminalId: terminal.id }, secret, { expiresIn, subject: terminal.id });
}

export async function iniciarSesionTerminal(username: string, password: string): Promise<ResultadoLoginTerminal> {
  const terminal = await prisma.terminal.findUnique({ where: { username } });

  const passwordValida = await bcrypt.compare(password, terminal?.passwordHash ?? HASH_SENUELO);

  if (!terminal || !passwordValida) {
    throw new AppError(401, MENSAJE_CREDENCIALES_INVALIDAS);
  }

  if (!terminal.activo) {
    throw new AppError(403, MENSAJE_TERMINAL_DESACTIVADO);
  }

  const token = firmarTokenTerminal(terminal);
  return { token, terminal: serializarTerminal(terminal) };
}

import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Terminal } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarTerminal, TerminalPublico } from "../utils/terminalSerializer";

const MENSAJE_CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos.";
const MENSAJE_TERMINAL_DESACTIVADO = "Este terminal está desactivado. Contacta a un administrador.";
// Un Terminal tipo="adms" (ej. el lector ZKTeco MB10-VL) nunca debería tener
// una sesión JWT: el equipo físico solo habla el protocolo ADMS/HTTP sobre
// /iclock/*, protegido por restringirPorIP.ts, no por JWT. Sin este rechazo,
// alguien con esas credenciales podía saltarse por completo esa protección
// —entrando por login-terminal en vez de /iclock/*— e inyectar asistencias
// falsas vía POST /asistencias como si fuera un Kiosco real. Bypass real,
// no solo teórico: cerrado aquí explícitamente.
const MENSAJE_TIPO_ADMS_NO_PERMITIDO =
  "Los terminales tipo ADMS no pueden iniciar sesión — usan el protocolo ADMS/HTTP, no JWT.";

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

  // Variable separada de JWT_EXPIRES_IN (auth.service.ts, sesión humana del
  // panel): un Terminal es un kiosco físico sin quien vuelva a teclear
  // credenciales cuando expire, así que su sesión dura mucho más ("30d" por
  // default) — expirarlo con la misma frecuencia que una sesión humana
  // dejaría el kiosco pidiendo login sin que nadie esté ahí para hacerlo.
  const expiresIn = (process.env.JWT_EXPIRES_IN_TERMINAL || "30d") as SignOptions["expiresIn"];

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

  // Después de validar password/activo a propósito (mismo criterio que el
  // resto de este archivo): no revelar el tipo de un terminal a quien no
  // demostró conocer su contraseña.
  if (terminal.tipo === "adms") {
    throw new AppError(403, MENSAJE_TIPO_ADMS_NO_PERMITIDO);
  }

  const token = firmarTokenTerminal(terminal);
  return { token, terminal: serializarTerminal(terminal) };
}

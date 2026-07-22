import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Usuario } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarUsuarioConSecciones, UsuarioPublicoConSecciones } from "../utils/usuarioSerializer";

const INCLUIR_SECCIONES_ASIGNADAS = {
  seccionesAsignadas: { select: { id: true, nombre: true } },
} as const;

const MENSAJE_CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos.";
const MENSAJE_CUENTA_DESACTIVADA = "Esta cuenta está desactivada. Contacta a un administrador.";

/**
 * Hash bcrypt "señuelo": no corresponde a ninguna cuenta real. Se usa para
 * comparar cuando el username no existe, de modo que bcrypt.compare siempre
 * haga el mismo trabajo y el tiempo de respuesta no delate si la cuenta existe.
 */
const HASH_SENUELO = "$2b$10$Kub8YdpWySlJS5Itfm4ku.piTu3HZ.mdUtfP1e4z28Rd/fW3p3IHK";

export interface ResultadoLogin {
  token: string;
  usuario: UsuarioPublicoConSecciones;
}

function firmarToken(usuario: Usuario): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // No hay valor por defecto para el secreto: preferimos que el servidor
    // falle a arrancar mal configurado antes que firmar tokens inseguros.
    throw new Error("JWT_SECRET no está configurado");
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"];

  return jwt.sign(
    {
      usuarioId: usuario.id,
      rol: usuario.rol,
      trabajadorId: usuario.trabajadorId,
    },
    secret,
    { expiresIn, subject: usuario.id }
  );
}

export async function iniciarSesion(username: string, password: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({
    where: { username },
    include: INCLUIR_SECCIONES_ASIGNADAS,
  });

  // bcrypt.compare corre siempre, exista o no el usuario, contra un hash real
  // en ambos casos (el del usuario o el señuelo) para no filtrar por timing
  // si el username existe.
  const passwordValida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_SENUELO);

  if (!usuario || !passwordValida) {
    // Mismo mensaje y mismo status para "no existe" y "contraseña incorrecta":
    // nunca revelar cuál de los dos fue.
    throw new AppError(401, MENSAJE_CREDENCIALES_INVALIDAS);
  }

  if (!usuario.activo) {
    // Solo se llega aquí con contraseña correcta; aun así se rechaza.
    throw new AppError(403, MENSAJE_CUENTA_DESACTIVADA);
  }

  const token = firmarToken(usuario);
  return { token, usuario: serializarUsuarioConSecciones(usuario) };
}

export async function obtenerUsuarioPublicoPorId(usuarioId: string): Promise<UsuarioPublicoConSecciones | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: INCLUIR_SECCIONES_ASIGNADAS,
  });
  return usuario ? serializarUsuarioConSecciones(usuario) : null;
}

const RONDAS_BCRYPT = 10;

// Autoservicio: cualquier cuenta logueada cambia su propia contraseña
// conociendo la actual — independiente del reseteo por administrador
// (usuario.service.ts resetearPassword), que no requiere la actual pero
// marca requiereCambioPassword=true. Este camino la limpia.
export async function cambiarPropiaPassword(
  usuarioId: string,
  passwordActual: string,
  passwordNueva: string
): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw new AppError(404, "Usuario no encontrado.");
  }

  const passwordValida = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!passwordValida) {
    throw new AppError(401, "La contraseña actual no es correcta.");
  }

  const passwordHash = await bcrypt.hash(passwordNueva, RONDAS_BCRYPT);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash, requiereCambioPassword: false },
    });

    await tx.auditLog.create({
      data: {
        usuarioId,
        accion: "cambiar_propia_password",
        entidad: "Usuario",
        entidadId: usuarioId,
        detalle: { username: usuario.username },
      },
    });
  });
}

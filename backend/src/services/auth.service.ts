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

// Bloqueo por intentos fallidos — independiente del rate limit por
// IP/usuario de middlewares/rateLimit.ts: aquella limita peticiones por
// origen; esto bloquea la CUENTA específica sin importar desde qué IP
// vengan los intentos (ej. un atacante repartiendo intentos entre varias
// IPs para evadir el rate limit no evade esto).
const MAX_INTENTOS_FALLIDOS = 5;
const DURACION_BLOQUEO_MINUTOS = 15;

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

  // "8h" (una jornada laboral), no "1d": esta es la sesión de un humano en
  // el panel administrativo — el frontend además cierra sesión sola tras 30
  // minutos de inactividad (ver AdminLayout), pero el JWT necesita su propio
  // tope absoluto independiente de esa detección de actividad. Distinto de
  // JWT_EXPIRES_IN_TERMINAL (terminalAuth.service.ts): un kiosco es un
  // dispositivo físico sin quien vuelva a teclear credenciales, no la
  // sesión de un humano — no debería expirar con la misma frecuencia.
  const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];

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

  // Se revisa ANTES de comparar la contraseña — mientras la cuenta esté
  // bloqueada, se rechaza sin importar si la contraseña enviada es
  // correcta o no (el bloqueo es por tiempo, no "hasta el próximo acierto").
  // Solo aplica si el usuario existe: un username inexistente sigue dando
  // el mismo mensaje genérico de siempre, sin revelar que no existe.
  if (usuario?.bloqueadoHasta && usuario.bloqueadoHasta.getTime() > Date.now()) {
    const minutosRestantes = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000);
    throw new AppError(
      423,
      `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`
    );
  }

  // bcrypt.compare corre siempre, exista o no el usuario, contra un hash real
  // en ambos casos (el del usuario o el señuelo) para no filtrar por timing
  // si el username existe.
  const passwordValida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_SENUELO);

  if (!usuario || !passwordValida) {
    if (usuario) {
      await registrarIntentoFallido(usuario);
    }
    // Mismo mensaje y mismo status para "no existe" y "contraseña incorrecta":
    // nunca revelar cuál de los dos fue.
    throw new AppError(401, MENSAJE_CREDENCIALES_INVALIDAS);
  }

  if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  }

  if (!usuario.activo) {
    // Solo se llega aquí con contraseña correcta; aun así se rechaza.
    throw new AppError(403, MENSAJE_CUENTA_DESACTIVADA);
  }

  const token = firmarToken(usuario);
  return { token, usuario: serializarUsuarioConSecciones(usuario) };
}

async function registrarIntentoFallido(usuario: Usuario): Promise<void> {
  // Si el bloqueo anterior ya expiró, este intento empieza un conteo nuevo
  // (1) en vez de seguir acumulando desde el conteo previo al bloqueo — de
  // lo contrario, justo después de cumplirse el tiempo de bloqueo, un solo
  // intento fallido más (ej. un simple error de tipeo del usuario legítimo)
  // volvería a bloquear la cuenta de inmediato, porque el conteo ya estaba
  // en el máximo.
  const bloqueoAnteriorYaExpiro = usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta.getTime() <= Date.now();
  const intentosPrevios = bloqueoAnteriorYaExpiro ? 0 : usuario.intentosFallidos;
  const nuevosIntentos = intentosPrevios + 1;
  const seBloquea = nuevosIntentos >= MAX_INTENTOS_FALLIDOS;

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: nuevosIntentos,
        bloqueadoHasta: seBloquea
          ? new Date(Date.now() + DURACION_BLOQUEO_MINUTOS * 60_000)
          : bloqueoAnteriorYaExpiro
            ? null
            : undefined,
      },
    });

    if (seBloquea) {
      await tx.auditLog.create({
        data: {
          // No hay otro actor humano involucrado en un login fallido — la
          // cuenta bloqueada es tanto el "actor" como el objetivo del log.
          usuarioId: usuario.id,
          accion: "bloquear_cuenta_por_intentos_fallidos",
          entidad: "Usuario",
          entidadId: usuario.id,
          detalle: { username: usuario.username, intentosFallidos: nuevosIntentos, duracionMinutos: DURACION_BLOQUEO_MINUTOS },
        },
      });
    }
  });
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

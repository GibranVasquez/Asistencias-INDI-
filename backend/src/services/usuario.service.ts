import bcrypt from "bcrypt";
import { RolUsuario } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AppError } from "../utils/AppError";
import { serializarUsuario, UsuarioPublico } from "../utils/usuarioSerializer";

const RONDAS_BCRYPT = 10;

export interface DatosAltaUsuario {
  username: string;
  password: string;
  rol: RolUsuario;
  trabajadorId?: string | null;
  seccionesAsignadas?: string[];
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  const usuarios = await prisma.usuario.findMany({ orderBy: { username: "asc" } });
  return usuarios.map(serializarUsuario);
}

export async function crearUsuario(usuarioCreadorId: string, datos: DatosAltaUsuario): Promise<UsuarioPublico> {
  const existente = await prisma.usuario.findUnique({ where: { username: datos.username } });
  if (existente) {
    throw new AppError(409, "Ya existe una cuenta con ese username.");
  }

  if (datos.rol === RolUsuario.trabajador) {
    const trabajador = await prisma.trabajador.findUnique({ where: { id: datos.trabajadorId! } });
    if (!trabajador) {
      throw new AppError(404, "El trabajador indicado no existe.");
    }

    const yaTieneCuenta = await prisma.usuario.findUnique({ where: { trabajadorId: datos.trabajadorId! } });
    if (yaTieneCuenta) {
      throw new AppError(409, "Ese trabajador ya tiene una cuenta asociada.");
    }
  }

  if (datos.seccionesAsignadas && datos.seccionesAsignadas.length > 0) {
    const secciones = await prisma.seccion.findMany({ where: { id: { in: datos.seccionesAsignadas } } });
    if (secciones.length !== datos.seccionesAsignadas.length) {
      throw new AppError(400, "Una o más secciones indicadas no existen.");
    }
  }

  const passwordHash = await bcrypt.hash(datos.password, RONDAS_BCRYPT);

  const usuario = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.usuario.create({
      data: {
        username: datos.username,
        passwordHash,
        rol: datos.rol,
        trabajadorId: datos.rol === RolUsuario.trabajador ? datos.trabajadorId : null,
        seccionesAsignadas: datos.seccionesAsignadas?.length
          ? { connect: datos.seccionesAsignadas.map((id) => ({ id })) }
          : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioCreadorId,
        accion: "crear_usuario",
        entidad: "Usuario",
        entidadId: nuevo.id,
        detalle: {
          username: nuevo.username,
          rol: nuevo.rol,
          trabajadorId: nuevo.trabajadorId,
          seccionesAsignadas: datos.seccionesAsignadas ?? [],
        },
      },
    });

    return nuevo;
  });

  return serializarUsuario(usuario);
}

export async function cambiarEstadoUsuario(
  usuarioActorId: string,
  usuarioObjetivoId: string,
  activo: boolean
): Promise<UsuarioPublico> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioObjetivoId } });
  if (!usuario) {
    throw new AppError(404, "Usuario no encontrado.");
  }

  if (usuarioObjetivoId === usuarioActorId && !activo) {
    throw new AppError(400, "No puedes dar de baja tu propia cuenta.");
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.usuario.update({ where: { id: usuarioObjetivoId }, data: { activo } });

    await tx.auditLog.create({
      data: {
        usuarioId: usuarioActorId,
        accion: activo ? "reactivar_usuario" : "dar_de_baja_usuario",
        entidad: "Usuario",
        entidadId: usuarioObjetivoId,
        detalle: { username: nuevo.username, activoAnterior: usuario.activo, activoNuevo: activo },
      },
    });

    return nuevo;
  });

  return serializarUsuario(actualizado);
}

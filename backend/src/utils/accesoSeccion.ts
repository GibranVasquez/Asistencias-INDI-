import { RolUsuario } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./AppError";

/**
 * rh no tiene restriccion de seccion. encargado_seccion solo puede operar
 * sobre las secciones que tiene vinculadas via la relacion N:N
 * Usuario.seccionesAsignadas <-> Seccion.encargados.
 */
export async function verificarAccesoSeccion(usuarioId: string, rol: RolUsuario, seccionId: string): Promise<void> {
  if (rol === RolUsuario.rh) {
    return;
  }

  const tieneAcceso = await prisma.usuario.count({
    where: { id: usuarioId, seccionesAsignadas: { some: { id: seccionId } } },
  });
  if (tieneAcceso === 0) {
    throw new AppError(403, "No tienes esa sección asignada.");
  }
}

import { RolUsuario } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./AppError";

/**
 * RH no tiene restricción de Frente. encargado_seccion solo puede operar
 * sobre los Frentes que tiene vinculados vía la relación N:N
 * Usuario.seccionesAsignadas <-> Seccion.encargados. Una cuenta sin
 * asociaciones falla cerrada: nunca se interpreta como acceso global.
 */
export async function verificarAccesoSeccion(usuarioId: string, rol: RolUsuario, seccionId: string): Promise<void> {
  if (rol === RolUsuario.rh) {
    return;
  }

  const tieneAcceso = await prisma.usuario.count({
    where: { id: usuarioId, seccionesAsignadas: { some: { id: seccionId } } },
  });
  if (tieneAcceso === 0) {
    throw new AppError(403, "No tienes ese Frente asignado.");
  }
}

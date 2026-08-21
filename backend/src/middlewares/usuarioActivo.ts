import { prisma } from "../utils/prisma";

/**
 * Revalida que el principal humano del JWT todavía exista y siga activo.
 * Los JWT de Terminal conservan su validación independiente porque
 * representan otra identidad y otro modelo de persistencia.
 */
export async function usuarioSigueActivo(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { activo: true },
  });
  return usuario?.activo === true;
}

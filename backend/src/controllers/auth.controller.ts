import { Request, Response } from "express";
import { cambiarPropiaPassword, iniciarSesion, obtenerUsuarioPublicoPorId } from "../services/auth.service";
import { AppError } from "../utils/AppError";

// Express 5 reenvía automáticamente los rechazos de promesas de handlers
// async al errorHandler, así que no hace falta try/catch aquí.

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const resultado = await iniciarSesion(username, password);
  res.json(resultado);
}

export async function usuarioActual(req: Request, res: Response): Promise<void> {
  // authMiddleware corrió antes en la ruta y garantiza req.user.
  const usuario = await obtenerUsuarioPublicoPorId(req.user!.usuarioId);

  if (!usuario) {
    // El usuario del token ya no existe (borrado, etc.): el token deja de ser válido.
    throw new AppError(401, "No autorizado.");
  }

  res.json({ usuario });
}

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  const { passwordActual, passwordNueva } = req.body;
  await cambiarPropiaPassword(req.user!.usuarioId, passwordActual, passwordNueva);
  res.status(204).send();
}

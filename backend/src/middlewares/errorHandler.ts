import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

const MENSAJE_ERROR_GENERICO = "Error interno del servidor";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Las excepciones desconocidas pueden contener consultas, rutas locales,
  // hostnames o detalles del proveedor de base de datos. Se registran en el
  // proceso para diagnóstico, pero nunca forman parte de la respuesta HTTP,
  // tampoco en desarrollo: Electron presenta este campo directamente al
  // usuario y una falla de Prisma no debe convertirse en fuga de información.
  res.status(500).json({ error: MENSAJE_ERROR_GENERICO });
}

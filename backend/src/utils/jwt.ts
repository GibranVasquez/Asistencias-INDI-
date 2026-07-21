import jwt from "jsonwebtoken";

export type ResultadoVerificacionJWT = { valido: true; payload: unknown } | { valido: false; motivo: string };

/**
 * Parsea el header Authorization y verifica la firma/expiración del JWT.
 * No valida la forma del payload (usuario vs. terminal) — eso lo hace cada
 * middleware llamador según el tipo de token que espera.
 */
export function verificarTokenJWT(authorizationHeader: string | undefined, secret: string): ResultadoVerificacionJWT {
  if (!authorizationHeader) {
    return { valido: false, motivo: "falta el header Authorization" };
  }

  const [esquema, token] = authorizationHeader.split(" ");
  if (esquema !== "Bearer" || !token) {
    return { valido: false, motivo: "el header Authorization no tiene el formato 'Bearer <token>'" };
  }

  try {
    const payload = jwt.verify(token, secret);
    return { valido: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valido: false, motivo: "el token está vencido" };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { valido: false, motivo: `el token es inválido o fue manipulado (${err.message})` };
    }
    return { valido: false, motivo: "error inesperado verificando el token" };
  }
}

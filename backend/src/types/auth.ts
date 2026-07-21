import { RolUsuario } from "@prisma/client";

export interface AuthTokenPayload {
  usuarioId: string;
  rol: RolUsuario;
  trabajadorId: string | null;
}

export function esAuthTokenPayload(payload: unknown): payload is AuthTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as AuthTokenPayload).usuarioId === "string" &&
    typeof (payload as AuthTokenPayload).rol === "string"
  );
}

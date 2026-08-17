import { Terminal } from "@prisma/client";

/**
 * Igual que UsuarioPublico: lista explícita de campos expuestos, para que
 * passwordHash nunca se filtre por accidente al agregar un campo al modelo.
 */
export interface TerminalPublico {
  id: string;
  username: string;
  tipo: string;
  ubicacion: string;
  numeroSerie: string | null;
  activo: boolean;
  estadoConexion: string;
  // Solo se actualiza para terminales tipo="adms" (ver adms.controller.ts,
  // handshake/subirDatos) — el equipo no tiene sesión JWT que "mantenga vivo"
  // un terminal Kiosco, así que este campo queda null para esos. Expuesto
  // para que el panel principal pueda advertir si el lector de oficina dejó de
  // sincronizar (ver DashboardPage.tsx).
  ultimaSincronizacion: string | null;
}

export function serializarTerminal(terminal: Terminal): TerminalPublico {
  return {
    id: terminal.id,
    username: terminal.username,
    tipo: terminal.tipo,
    ubicacion: terminal.ubicacion,
    numeroSerie: terminal.numeroSerie,
    activo: terminal.activo,
    estadoConexion: terminal.estadoConexion,
    ultimaSincronizacion: terminal.ultimaSincronizacion ? terminal.ultimaSincronizacion.toISOString() : null,
  };
}

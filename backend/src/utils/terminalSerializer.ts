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
  };
}

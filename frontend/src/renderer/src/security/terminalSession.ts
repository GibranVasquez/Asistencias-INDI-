import { TerminalPublico } from "../api/auth";

export const CLAVE_SESION_TERMINAL_LEGACY = "indi_terminal_sesion";

export interface SesionTerminal {
  token: string;
  terminal: TerminalPublico;
}

interface PuenteSesionTerminal {
  guardar: (valor: string) => Promise<void>;
  leer: () => Promise<string | null>;
  borrar: () => Promise<void>;
}

interface AlmacenamientoNoSensible {
  removeItem: (clave: string) => void;
}

function esSesionTerminal(valor: unknown): valor is SesionTerminal {
  if (!valor || typeof valor !== "object") return false;
  const candidato = valor as Partial<SesionTerminal>;
  return typeof candidato.token === "string" && candidato.token.length > 0 &&
    typeof candidato.terminal === "object" && candidato.terminal !== null;
}

export function crearPersistenciaSesionTerminal(
  puente: PuenteSesionTerminal | undefined,
  almacenamientoLocal: AlmacenamientoNoSensible
) {
  function exigirPuente(): PuenteSesionTerminal {
    if (!puente) {
      throw new Error("El almacenamiento seguro del Terminal no está disponible.");
    }
    return puente;
  }

  return {
    async restaurar(): Promise<SesionTerminal | null> {
      // Nunca migramos un JWT heredado desde localStorage: se elimina y se
      // exige una activación nueva que pueda cifrarse correctamente.
      almacenamientoLocal.removeItem(CLAVE_SESION_TERMINAL_LEGACY);
      const crudo = await exigirPuente().leer();
      if (!crudo) return null;
      try {
        const sesion: unknown = JSON.parse(crudo);
        if (esSesionTerminal(sesion)) return sesion;
      } catch {
        // La sesión corrupta se elimina abajo, sin exponer su contenido.
      }
      await exigirPuente().borrar();
      return null;
    },

    async guardar(sesion: SesionTerminal): Promise<void> {
      await exigirPuente().guardar(JSON.stringify(sesion));
    },

    async borrar(): Promise<void> {
      await exigirPuente().borrar();
      almacenamientoLocal.removeItem(CLAVE_SESION_TERMINAL_LEGACY);
    },
  };
}

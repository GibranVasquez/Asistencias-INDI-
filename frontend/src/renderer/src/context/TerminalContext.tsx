import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { TerminalPublico } from "../api/auth";

const CLAVE_SESION = "indi_terminal_sesion";
const CLAVE_CONFIG = "indi_terminal_config";

interface SesionTerminal {
  token: string;
  terminal: TerminalPublico;
}

// Config fisica del kiosco. Dos modos:
// - "marcacion" (default, comportamiento historico): a que seccion
//   pertenece el dispositivo y en que turno opera, para marcar
//   manualmente via POST /asistencias.
// - "confirmacion": pantalla secundaria del lector ADMS de oficina (ZKTeco
//   MB10-VL) — nunca marca nada, solo hace polling de GET
//   /asistencias/reciente y muestra la animacion de exito ya existente
//   cuando el equipo ADMS reporta una marcacion nueva. seccionId/turno no
//   aplican (el backend ya fija "Oficina"/"Oficina" para todo lo que venga
//   de un terminal tipo="adms" — ver adms.service.ts).
export interface ConfigKiosco {
  modo?: "marcacion" | "confirmacion";
  seccionId?: string;
  turno?: string;
}

interface TerminalContextValor {
  sesion: SesionTerminal | null;
  config: ConfigKiosco | null;
  iniciarSesion: (sesion: SesionTerminal) => void;
  cerrarSesion: () => void;
  guardarConfig: (config: ConfigKiosco) => void;
  limpiarConfig: () => void;
}

const TerminalContext = createContext<TerminalContextValor | null>(null);

function leerJSON<T>(clave: string): T | null {
  const crudo = localStorage.getItem(clave);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    return null;
  }
}

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionTerminal | null>(() => leerJSON(CLAVE_SESION));
  const [config, setConfig] = useState<ConfigKiosco | null>(() => leerJSON(CLAVE_CONFIG));

  const valor = useMemo<TerminalContextValor>(
    () => ({
      sesion,
      config,
      iniciarSesion: (nuevaSesion) => {
        localStorage.setItem(CLAVE_SESION, JSON.stringify(nuevaSesion));
        setSesion(nuevaSesion);
      },
      cerrarSesion: () => {
        localStorage.removeItem(CLAVE_SESION);
        setSesion(null);
      },
      guardarConfig: (nuevaConfig) => {
        localStorage.setItem(CLAVE_CONFIG, JSON.stringify(nuevaConfig));
        setConfig(nuevaConfig);
      },
      limpiarConfig: () => {
        localStorage.removeItem(CLAVE_CONFIG);
        setConfig(null);
      },
    }),
    [sesion, config]
  );

  return <TerminalContext.Provider value={valor}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValor {
  const contexto = useContext(TerminalContext);
  if (!contexto) {
    throw new Error("useTerminal debe usarse dentro de <TerminalProvider>.");
  }
  return contexto;
}

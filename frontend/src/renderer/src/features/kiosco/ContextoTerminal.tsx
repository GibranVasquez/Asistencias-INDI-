import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { crearPersistenciaSesionTerminal, SesionTerminal } from "@/features/kiosco/terminalSession";

const CLAVE_CONFIG = "indi_terminal_config";

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

interface ValorContextoTerminal {
  sesion: SesionTerminal | null;
  config: ConfigKiosco | null;
  restaurandoSesion: boolean;
  errorAlmacenamiento: string | null;
  iniciarSesion: (sesion: SesionTerminal) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  guardarConfig: (config: ConfigKiosco) => void;
  limpiarConfig: () => void;
}

const ContextoTerminal = createContext<ValorContextoTerminal | null>(null);

function leerJSON<T>(clave: string): T | null {
  const crudo = localStorage.getItem(clave);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    return null;
  }
}

export function ProveedorTerminal({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionTerminal | null>(null);
  const [config, setConfig] = useState<ConfigKiosco | null>(() => leerJSON(CLAVE_CONFIG));
  const [restaurandoSesion, setRestaurandoSesion] = useState(true);
  const [errorAlmacenamiento, setErrorAlmacenamiento] = useState<string | null>(null);

  const persistencia = useMemo(
    () => crearPersistenciaSesionTerminal(window.indiApp?.sesionTerminalSegura, localStorage),
    []
  );

  useEffect(() => {
    let activo = true;
    persistencia.restaurar()
      .then((restaurada) => {
        if (activo) setSesion(restaurada);
      })
      .catch(() => {
        if (activo) setErrorAlmacenamiento("No se pudo abrir el almacenamiento seguro del Terminal.");
      })
      .finally(() => {
        if (activo) setRestaurandoSesion(false);
      });
    return () => { activo = false; };
  }, [persistencia]);

  const valor = useMemo<ValorContextoTerminal>(
    () => ({
      sesion,
      config,
      restaurandoSesion,
      errorAlmacenamiento,
      iniciarSesion: async (nuevaSesion) => {
        await persistencia.guardar(nuevaSesion);
        setSesion(nuevaSesion);
        setErrorAlmacenamiento(null);
      },
      cerrarSesion: async () => {
        await persistencia.borrar();
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
    [sesion, config, restaurandoSesion, errorAlmacenamiento, persistencia]
  );

  return <ContextoTerminal.Provider value={valor}>{children}</ContextoTerminal.Provider>;
}

export function useTerminal(): ValorContextoTerminal {
  const contexto = useContext(ContextoTerminal);
  if (!contexto) {
    throw new Error("useTerminal debe usarse dentro de <ProveedorTerminal>.");
  }
  return contexto;
}

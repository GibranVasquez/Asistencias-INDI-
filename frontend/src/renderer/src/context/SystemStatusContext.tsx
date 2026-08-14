import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { comprobarSalud } from "../api/client";
import { useMaintenance } from "./MaintenanceContext";

export type EstadoSistema = "comprobando" | "conectado" | "sin_conexion" | "mantenimiento";
interface EstadoSistemaContexto { estado: EstadoSistema; ultimaComprobacion: Date | null; comprobarAhora: () => Promise<void> }
const Contexto = createContext<EstadoSistemaContexto | null>(null);
const INTERVALO_COMPROBACION_MS = 45_000;

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const mantenimiento = useMaintenance();
  const [estadoRed, setEstadoRed] = useState<EstadoSistema>("comprobando");
  const [ultimaComprobacion, setUltimaComprobacion] = useState<Date | null>(null);
  const enVuelo = useRef(false);
  const comprobarAhora = useCallback(async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    const disponible = await comprobarSalud();
    setEstadoRed(disponible ? "conectado" : "sin_conexion");
    setUltimaComprobacion(new Date());
    enVuelo.current = false;
  }, []);
  useEffect(() => {
    void comprobarAhora();
    const intervalo = window.setInterval(() => void comprobarAhora(), INTERVALO_COMPROBACION_MS);
    const alVolver = () => void comprobarAhora();
    window.addEventListener("focus", alVolver); window.addEventListener("online", alVolver); window.addEventListener("offline", alVolver);
    return () => { window.clearInterval(intervalo); window.removeEventListener("focus", alVolver); window.removeEventListener("online", alVolver); window.removeEventListener("offline", alVolver); };
  }, [comprobarAhora]);
  const estado: EstadoSistema = mantenimiento ? "mantenimiento" : estadoRed;
  return <Contexto.Provider value={{ estado, ultimaComprobacion, comprobarAhora }}>{children}</Contexto.Provider>;
}
export function useSystemStatus() { const valor = useContext(Contexto); if (!valor) throw new Error("useSystemStatus requiere SystemStatusProvider"); return valor; }

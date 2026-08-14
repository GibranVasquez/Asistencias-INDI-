import { useSystemStatus } from "../context/SystemStatusContext";

const ETIQUETAS = { comprobando: "Comprobando sistema", conectado: "Sistema conectado", sin_conexion: "Sin conexión", mantenimiento: "Mantenimiento" };
export default function SystemStatusIndicator({ compacto = false }: { compacto?: boolean }) {
  const { estado, ultimaComprobacion, comprobarAhora } = useSystemStatus();
  const detalle = ultimaComprobacion ? `Última comprobación: ${ultimaComprobacion.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Comprobación inicial pendiente";
  return <button type="button" className={`system-status ${estado}${compacto ? " compacto" : ""}`} onClick={() => void comprobarAhora()} aria-label={`${ETIQUETAS[estado]}. ${detalle}`} title={`${ETIQUETAS[estado]} · ${detalle}`}>
    <span className="system-status-dot" aria-hidden="true" />{!compacto && <span>{ETIQUETAS[estado]}</span>}
  </button>;
}

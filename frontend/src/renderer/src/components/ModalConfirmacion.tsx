import { ReactNode, useState } from "react";
import Boton from "./Boton";

interface ModalConfirmacionProps {
  titulo: string;
  mensaje: ReactNode;
  etiquetaConfirmar?: string;
  peligroso?: boolean;
  onConfirmar: () => void | Promise<void>;
  onCancelar: () => void;
}

// Confirmación compartida para acciones destructivas/irreversibles (dar de
// baja, desactivar, borrar) — antes cada botón ejecutaba la mutación
// directo al primer clic, sin ningún paso intermedio. Mismo patrón visual
// de overlay que ya usan los modales de alta/edición (UsuariosPage,
// TerminalesPage, ConfiguracionPage: position fixed + rgba(0,0,0,.35) +
// clic fuera cierra), pero como componente propio en vez de repetirlo.
export default function ModalConfirmacion({
  titulo,
  mensaje,
  etiquetaConfirmar = "Confirmar",
  peligroso = true,
  onConfirmar,
  onCancelar,
}: ModalConfirmacionProps) {
  const [procesando, setProcesando] = useState(false);

  async function manejarConfirmar() {
    setProcesando(true);
    try {
      await onConfirmar();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={procesando ? undefined : onCancelar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 400, maxWidth: "90vw" }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{titulo}</h3>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>{mensaje}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <Boton variante="outline" type="button" onClick={onCancelar} disabled={procesando} style={{ flex: 1 }}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            onClick={manejarConfirmar}
            disabled={procesando}
            textoEnProceso="Procesando…"
            style={{ flex: 1, ...(peligroso ? { background: "var(--err)" } : {}) }}
          >
            {etiquetaConfirmar}
          </Boton>
        </div>
      </div>
    </div>
  );
}

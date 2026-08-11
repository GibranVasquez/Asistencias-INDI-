import { KeyboardEvent, ReactNode, useId, useState } from "react";
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
  const tituloId = useId();

  function mantenerFocoEnDialogo(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape" && !procesando) {
      evento.preventDefault();
      onCancelar();
      return;
    }
    if (evento.key !== "Tab") return;

    const botones = [...evento.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    if (botones.length === 0) return;
    const primero = botones[0];
    const ultimo = botones.at(-1)!;
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  async function manejarConfirmar() {
    setProcesando(true);
    try {
      await onConfirmar();
    } catch {
      // onConfirmar ya registra/muestra su propio error (banner rojo bajo
      // la fila en la tabla de fondo) y, a propósito, ya NO llama a su
      // setConfirmandoX(null) cuando falla — así el modal se queda abierto
      // con la acción todavía pendiente en vez de cerrarse dando sensación
      // de éxito. Este catch solo evita que la rejection quede sin manejar.
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onKeyDown={mantenerFocoEnDialogo}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 400, maxWidth: "90vw" }}
      >
        <h3 id={tituloId} style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{titulo}</h3>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>{mensaje}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <Boton variante="outline" type="button" onClick={onCancelar} disabled={procesando} style={{ flex: 1 }}>
            Cancelar
          </Boton>
          <Boton
            autoFocus
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

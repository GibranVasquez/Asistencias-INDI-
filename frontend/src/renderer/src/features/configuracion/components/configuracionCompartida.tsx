import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import Boton from "@/shared/components/Boton";

export const estilosCampo = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid var(--line)",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }

    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop configuracion-modal-backdrop" onClick={onClose}>
      <div className="modal-panel configuracion-modal" role="dialog" aria-modal="true" onClick={(evento) => evento.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 14 }}>
      {etiqueta}
      {children}
    </label>
  );
}

export function BotonesModal({ guardando, onCancelar, etiqueta }: { guardando: boolean; onCancelar: () => void; etiqueta: string }) {
  return (
    <div className="configuracion-modal-acciones" style={{ display: "flex", gap: 10, marginTop: 4 }}>
      <Boton variante="outline" type="button" onClick={onCancelar} style={{ flex: 1 }}>
        Cancelar
      </Boton>
      <Boton type="submit" disabled={guardando} style={{ flex: 1 }}>
        {guardando ? "Guardando…" : etiqueta}
      </Boton>
    </div>
  );
}

export function ErrorInline({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div style={{ fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
      {mensaje}
    </div>
  );
}

export function Check({ etiqueta, checked, onChange }: { etiqueta: string; checked: boolean; onChange: (valor: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={(evento) => onChange(evento.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--indi2)" }} />
      {etiqueta}
    </label>
  );
}

export function Pill({ activo, etiquetaSi = "Sí", etiquetaNo = "—" }: { activo: boolean; etiquetaSi?: string; etiquetaNo?: string }) {
  if (!activo) return <span style={{ color: "var(--muted)" }}>{etiquetaNo}</span>;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ok)", background: "rgba(47,174,102,.12)", padding: "3px 10px", borderRadius: 999 }}>
      {etiquetaSi}
    </span>
  );
}

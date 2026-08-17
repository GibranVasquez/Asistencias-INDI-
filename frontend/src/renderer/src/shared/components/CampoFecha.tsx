import { CSSProperties, InputHTMLAttributes, useRef } from "react";

type CampoFechaProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const ESTILO_BASE: CSSProperties = {
  padding: "9px 10px",
  paddingRight: 32,
  borderRadius: 8,
  border: "1.5px solid var(--line)",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

export default function CampoFecha({ style, disabled, ...resto }: CampoFechaProps) {
  const ref = useRef<HTMLInputElement>(null);

  function abrirPicker() {
    if (disabled) return;
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <input
        ref={ref}
        type="date"
        disabled={disabled}
        className="campo-fecha-input"
        {...resto}
        style={{ ...ESTILO_BASE, ...style }}
      />
      <button
        type="button"
        onClick={abrirPicker}
        disabled={disabled}
        aria-label="Abrir calendario"
        style={{
          position: "absolute",
          right: 8,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          color: "var(--muted)",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
  );
}

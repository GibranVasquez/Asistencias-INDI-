import { CSSProperties, useState } from "react";

// Misma política que valida el backend (utils/validacion.ts,
// validarFortalezaPassword) — si se desincroniza, el peor caso es que el
// checklist muestre "cumple" y el backend igual rechace con su propio
// mensaje (nunca al revés: el backend es la fuente de verdad real).
const REQUISITOS: { id: string; etiqueta: string; cumple: (valor: string) => boolean }[] = [
  { id: "longitud", etiqueta: "Al menos 8 caracteres", cumple: (v) => v.length >= 8 },
  { id: "letra", etiqueta: "Al menos una letra", cumple: (v) => /[a-zA-Z]/.test(v) },
  { id: "numero", etiqueta: "Al menos un número", cumple: (v) => /[0-9]/.test(v) },
];

function IconoOjo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconoOjoTachado() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconoCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconoPunto() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface CampoContrasenaProps {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  style: CSSProperties;
  required?: boolean;
  autoFocus?: boolean;
  // Checklist de requisitos en tiempo real - solo tiene sentido cuando el
  // campo es una contraseña NUEVA (crear cuenta, cambiar la propia,
  // resetear); no para "contraseña actual"/login, donde el valor ya existe
  // y no se está evaluando contra ninguna política.
  mostrarRequisitos?: boolean;
}

export default function CampoContrasena({
  id,
  value,
  onChange,
  style,
  required,
  autoFocus,
  mostrarRequisitos,
}: CampoContrasenaProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          style={{ ...style, width: "100%", boxSizing: "border-box", paddingRight: 42 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            display: "flex",
            color: "var(--muted)",
          }}
        >
          {visible ? <IconoOjoTachado /> : <IconoOjo />}
        </button>
      </div>

      {mostrarRequisitos && value.length > 0 && (
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {REQUISITOS.map((r) => {
            const ok = r.cumple(value);
            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: ok ? "var(--ok)" : "var(--muted)",
                }}
              >
                <span style={{ display: "inline-flex", flexShrink: 0 }}>{ok ? <IconoCheck /> : <IconoPunto />}</span>
                {r.etiqueta}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

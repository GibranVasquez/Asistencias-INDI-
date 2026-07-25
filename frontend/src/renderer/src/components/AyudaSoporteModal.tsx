// Datos de contacto PLACEHOLDER — reemplazar por los reales del equipo de
// soporte de Grupo INDI antes de un uso real. Único lugar donde viven estos
// valores en todo el frontend.
const CONTACTO_SOPORTE = {
  telefono: "+52 55 0000 0000",
  correo: "soporte@grupoindi.example",
  horario: "Lunes a viernes, 9:00–18:00 (hora del centro de México)",
};

interface AyudaSoporteModalProps {
  onCerrar: () => void;
}

export default function AyudaSoporteModal({ onCerrar }: AyudaSoporteModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          padding: 26,
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Ayuda y soporte</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
          Si tienes problemas para acceder al sistema o encuentras algún error, contacta al equipo de soporte:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Teléfono
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{CONTACTO_SOPORTE.telefono}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Correo
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{CONTACTO_SOPORTE.correo}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Horario de atención
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{CONTACTO_SOPORTE.horario}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          style={{
            marginTop: 4,
            padding: 11,
            background: "var(--indi)",
            border: "none",
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

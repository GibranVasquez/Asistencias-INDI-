interface DeltaKPI {
  valor: number;
  direccion: "up" | "down";
}

interface TarjetaKPIProps {
  etiqueta: string;
  valor: string | number;
  // Punto de color + su fondo tenue — opcionales: si no se pasan, la tarjeta
  // se ve como la variante simple (antes usada solo en Reportes).
  color?: string;
  fondo?: string;
  nota?: string;
  // Badge ▲/▼ + % — opcional a propósito: hoy ninguna pantalla calcula un
  // delta real contra el periodo anterior, así que no se inventa un valor
  // decorativo en los call-sites actuales. Queda listo para cuando exista
  // ese cálculo.
  delta?: DeltaKPI;
}

export default function TarjetaKPI({ etiqueta, valor, color, fondo, nota, delta }: TarjetaKPIProps) {
  const valorEsLargo = typeof valor === "string" && valor.length > 4;

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {color && fondo && (
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: fondo, border: `2px solid ${color}` }} />
        )}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>{etiqueta}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: valorEsLargo ? 16 : 32, color: "var(--ink)" }}>
          {valor}
        </div>
        {delta && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11.5,
              fontWeight: 700,
              color: delta.direccion === "up" ? "var(--ok)" : "var(--err)",
              background:
                delta.direccion === "up"
                  ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                  : "color-mix(in srgb, var(--err) 12%, transparent)",
              padding: "3px 8px",
              borderRadius: 999,
            }}
          >
            {delta.direccion === "up" ? "▲" : "▼"} {Math.abs(delta.valor)}%
          </span>
        )}
      </div>
      {nota && <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>{nota}</div>}
    </div>
  );
}

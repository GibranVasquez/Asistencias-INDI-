import { CSSProperties } from "react";

export interface BarraDashboard { etiqueta: string; valor: number; esFuturo: boolean }

export default function PanelGraficas({ barras, cargando, rango, aTiempo, tarde, error }: { barras: BarraDashboard[]; cargando: boolean; rango: string; aTiempo: number | null; tarde: number | null; error: string | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Asistencia por día</h3>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{rango === "dia" ? "Hoy" : rango === "semana" ? "Semana actual" : "Mes actual"}</span>
        </div>
        {cargando ? <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div> : <GraficaBarras barras={barras} />}
      </div>
      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", alignSelf: "flex-start" }}>Puntualidad</h3>
        <DonaPuntualidad key={rango} aTiempo={aTiempo} tarde={tarde} error={error} />
      </div>
    </div>
  );
}

function GraficaBarras({ barras }: { barras: BarraDashboard[] }) {
  if (barras.length === 0) return <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin datos en este periodo.</div>;
  const max = Math.max(...barras.map((b) => b.valor), 1);
  return <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 190, marginTop: 20, paddingBottom: 26, position: "relative" }}>
    {barras.map((b, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: b.esFuturo ? "var(--muted)" : "var(--indi)" }}>{b.esFuturo ? "—" : b.valor}</span>
      <div style={{ width: "100%", maxWidth: 46, height: `${Math.max((b.valor / max) * 100, 3)}%`, background: b.esFuturo ? "var(--pastel)" : "linear-gradient(180deg,var(--indi2),var(--indi))", borderRadius: "7px 7px 0 0" }} />
      <span style={{ position: "absolute", bottom: 0, fontSize: 12, color: "var(--muted)" }}>{b.etiqueta}</span>
    </div>)}
  </div>;
}

function DonaPuntualidad({ aTiempo, tarde, error }: { aTiempo: number | null; tarde: number | null; error: string | null }) {
  if (aTiempo === null || tarde === null) return <div style={{ padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>{error ?? "Cargando…"}</div>;
  const total = aTiempo + tarde;
  const porcentaje = total > 0 ? Math.round((aTiempo / total) * 100) : 0;
  return <>
    <div className="dona-puntualidad" role="img" aria-label={`${porcentaje}% a tiempo: ${aTiempo} a tiempo y ${tarde} con tardanza`} style={{ "--dona-porcentaje": `${porcentaje}%`, "--dona-valor-final": porcentaje, position: "relative", width: 150, height: 150, margin: "18px 0 6px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties}>
      <div className="dona-centro" style={{ width: 104, height: 104, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><span className="dona-valor" aria-hidden="true" style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 30, color: "var(--ink)" }} /><span className="solo-lectores">{porcentaje}%</span><span style={{ fontSize: 11, color: "var(--muted)" }}>a tiempo</span></div>
    </div>
    <div style={{ display: "flex", gap: 18, marginTop: 6, fontSize: 12.5 }}><span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--ok)" }} />A tiempo ({aTiempo})</span><span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--warn)" }} />Tardanza ({tarde})</span></div>
  </>;
}

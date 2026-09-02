import Boton from "@/shared/components/Boton";
import { ResultadoSincronizacion } from "./api";

interface Props {
  resultado: ResultadoSincronizacion;
  onCerrar: () => void;
}

export function ResultadoSincronizacionModal({ resultado, onCerrar }: Props) {
  const detalles = resultado.detallesErrores ?? [];
  return <div className="modal-backdrop" onClick={onCerrar}>
    <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="resultado-sync-titulo" onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: "min(520px, calc(100vw - 40px))", maxHeight: "min(700px, calc(100vh - 40px))", display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 id="resultado-sync-titulo" style={{ fontSize: 18, color: "var(--ink)", margin: 0 }}>Resultado de sincronización</h2>
      <div><p style={{ margin: "4px 0" }}>Leídas: {resultado.recibidas}</p><p style={{ margin: "4px 0" }}>Nuevas: {resultado.nuevas}</p><p style={{ margin: "4px 0" }}>Duplicadas: {resultado.duplicadas}</p><p style={{ margin: "4px 0" }}>Errores: {resultado.errores}</p></div>
      {resultado.errores > 0 && detalles.length > 0 && <section aria-labelledby="detalle-errores-titulo" style={{ minHeight: 0 }}>
        <h3 id="detalle-errores-titulo" style={{ fontSize: 14, margin: "4px 0 8px", color: "var(--ink)" }}>Detalle de errores</h3>
        <div role="list" style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
          {detalles.map((detalle, indice) => <div role="listitem" key={`${detalle.indice ?? indice}-${detalle.codigo}-${detalle.trabajadorExternoId ?? "sin-id"}`} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>Trabajador {detalle.trabajadorExternoId || "no identificado"}</div>
            <div style={{ color: "var(--err)", fontWeight: 600 }}>{detalle.codigo}</div>
            <div style={{ color: "var(--muted)", marginTop: 2 }}>{detalle.mensaje}</div>
          </div>)}
        </div>
      </section>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}><Boton type="button" onClick={onCerrar}>Cerrar</Boton></div>
    </div>
  </div>;
}

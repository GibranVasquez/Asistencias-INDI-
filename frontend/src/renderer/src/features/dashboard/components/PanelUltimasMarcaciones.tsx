import { useMemo } from "react";
import { AsistenciaListada } from "@/features/asistencias/api";
import { Trabajador } from "@/features/trabajadores/api";
import { Horario } from "@/core/api/resources/horarios";
import { Seccion } from "@/core/api/resources/secciones";
import { llegoATiempo } from "@/features/dashboard/panelPrincipalViewModel";
import ChipEstado from "@/shared/components/ChipEstado";
import EstadoVacio from "@/shared/components/EstadoVacio";

export default function PanelUltimasMarcaciones({ asistencias, trabajadores, secciones, horarios, cargando }: { asistencias: AsistenciaListada[] | null; trabajadores: Trabajador[] | null; secciones: Seccion[] | null; horarios: Horario[] | null; cargando: boolean }) {
  const ultimasMarcaciones = useMemo(() => [...(asistencias ?? [])].sort((a, b) => new Date(b.hora).getTime() - new Date(a.hora).getTime()).slice(0, 6), [asistencias]);
  const mapaTrabajadores = useMemo(() => new Map((trabajadores ?? []).map((trabajador) => [trabajador.id, trabajador])), [trabajadores]);
  const mapaHorarios = useMemo(() => new Map((horarios ?? []).map((horario) => [horario.id, horario])), [horarios]);
  const mapaSecciones = useMemo(() => new Map((secciones ?? []).map((seccion) => [seccion.id, seccion])), [secciones]);

  return <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginTop: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Últimas marcaciones de hoy</h3><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>{ultimasMarcaciones.length} registro{ultimasMarcaciones.length === 1 ? "" : "s"}</span></div>
    {cargando ? <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div> : ultimasMarcaciones.length === 0 ? <EstadoVacio titulo="Aún no hay marcaciones" descripcion="Las asistencias registradas hoy aparecerán aquí." /> : <div style={{ display: "flex", flexDirection: "column" }}>
      {ultimasMarcaciones.map((asistencia, i) => {
        const trabajador = mapaTrabajadores.get(asistencia.trabajadorId);
        const nombre = trabajador?.nombreCompleto ?? `ID ${asistencia.trabajadorId.slice(0, 8)}…`;
        const iniciales = trabajador ? trabajador.nombreCompleto.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() : "—";
        const horarioId = mapaSecciones.get(asistencia.seccionId)?.horarioId;
        const horario = horarioId ? mapaHorarios.get(horarioId) ?? null : null;
        const puntual = horario ? llegoATiempo(asistencia.hora, horario) : null;
        return <div key={asistencia.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i === ultimasMarcaciones.length - 1 ? "none" : "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--pastel)", color: "var(--indi)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{iniciales}</span><span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{nombre}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{puntual !== null && <ChipEstado tamano={26} color={puntual ? "ok" : "warn"} icono={puntual ? "✓" : "⏱"} titulo={puntual ? "A tiempo" : "Tardanza"} />}<span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: puntual === null ? "var(--muted)" : puntual ? "var(--ok)" : "var(--warn)" }}>{new Date(asistencia.hora).toISOString().slice(11, 16)}</span></div>
        </div>;
      })}
    </div>}
  </div>;
}

import TarjetaKPI from "@/shared/components/TarjetaKPI";
import IconoResumen from "@/features/dashboard/components/IconoResumen";

interface Props {
  etiquetaPeriodo: string;
  totalPeriodo: number | null;
  asistenciasError: string | null;
  porcentajeATiempo: number | null;
  puntualidadError: string | null;
  tarde: number | null;
  trabajadoresError: string | null;
  ausentesHoy: number | null;
  totalActivos: number | null;
}

export default function PanelKpis(props: Props) {
  return (
    <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 22 }}>
      <TarjetaKPI color="var(--indi2)" fondo="rgba(46,99,199,.12)" etiqueta={`Asistencias ${props.etiquetaPeriodo}`} valor={props.totalPeriodo === null ? props.asistenciasError ?? "…" : props.totalPeriodo} icono={<IconoResumen tipo="asistencia" />} />
      <TarjetaKPI color="var(--ok)" fondo="rgba(47,174,102,.12)" etiqueta="Puntualidad" valor={props.porcentajeATiempo === null ? props.puntualidadError ?? props.asistenciasError ?? "…" : `${props.porcentajeATiempo}%`} icono={<IconoResumen tipo="puntualidad" />} />
      <TarjetaKPI color="var(--warn)" fondo="rgba(242,169,59,.14)" etiqueta="Tardanzas" valor={props.tarde === null ? props.puntualidadError ?? props.asistenciasError ?? "…" : props.tarde} icono={<IconoResumen tipo="tardanza" />} />
      <TarjetaKPI color="var(--err)" fondo="rgba(229,72,77,.12)" etiqueta="Ausentes hoy" valor={props.ausentesHoy === null ? props.trabajadoresError ?? "…" : props.ausentesHoy} nota={props.totalActivos !== null ? `de ${props.totalActivos} trabajadores activos` : undefined} icono={<IconoResumen tipo="ausencia" />} />
    </div>
  );
}

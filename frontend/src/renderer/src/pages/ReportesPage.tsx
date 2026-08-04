import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import {
  exportarAsistencia,
  exportarNomina,
  HistoricoTrabajador,
  obtenerHistoricoTrabajador,
  obtenerReporteAsistencia,
  obtenerReporteNomina,
  ReporteAsistencia,
  ReporteNomina,
} from "../api/reportes";
import { listarSecciones, Seccion } from "../api/secciones";
import { listarTrabajadores, Trabajador } from "../api/trabajadores";
import { useAuth } from "../context/AuthContext";
import TarjetaKPI from "../components/TarjetaKPI";
import Boton from "../components/Boton";
import CampoFecha from "../components/CampoFecha";

type Tab = "asistencia" | "nomina";

const estilosCampo = {
  padding: "9px 10px",
  borderRadius: 8,
  border: "1.5px solid var(--line)",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

function hoyISO(): string {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}

function inicioDeMesISO(): string {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-01`;
}

function pct(valor: number | null): string {
  return valor === null ? "—" : `${valor}%`;
}

function moneda(valor: string): string {
  return `$${Number(valor).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function BotonesExportar({ onExportar }: { onExportar: (formato: "pdf" | "excel") => Promise<void> }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Boton variante="outline" tamano="pequeno" onClick={() => onExportar("pdf")} textoEnProceso="Exportando…">
        Exportar PDF
      </Boton>
      <Boton variante="outline" tamano="pequeno" onClick={() => onExportar("excel")} textoEnProceso="Exportando…">
        Exportar Excel
      </Boton>
    </div>
  );
}

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("asistencia");

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Reportes</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>Asistencia, puntualidad y financiero de nómina</p>

      <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 4, marginTop: 18, width: "fit-content" }}>
        <button
          onClick={() => setTab("asistencia")}
          style={{ padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", background: tab === "asistencia" ? "var(--indi)" : "transparent", color: tab === "asistencia" ? "var(--white)" : "var(--muted)", cursor: "pointer" }}
        >
          Asistencia y puntualidad
        </button>
        <button
          onClick={() => setTab("nomina")}
          style={{ padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", background: tab === "nomina" ? "var(--indi)" : "transparent", color: tab === "nomina" ? "var(--white)" : "var(--muted)", cursor: "pointer" }}
        >
          Financiero de nómina
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {tab === "asistencia" ? <PanelReporteAsistencia /> : <PanelReporteNomina />}
      </div>
    </div>
  );
}

function PanelReporteAsistencia() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [desde, setDesde] = useState(inicioDeMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [seccionId, setSeccionId] = useState("");
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);

  const [reporte, setReporte] = useState<ReporteAsistencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trabajadores, setTrabajadores] = useState<Trabajador[] | null>(null);
  const [busquedaTrabajador, setBusquedaTrabajador] = useState("");
  const [trabajadorId, setTrabajadorId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoTrabajador | null>(null);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);

  useEffect(() => {
    listarSecciones(token).then((r) => setSecciones(r.secciones)).catch(() => setSecciones([]));
    listarTrabajadores(token).then((r) => setTrabajadores(r.trabajadores)).catch(() => setTrabajadores([]));
  }, [token]);

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerReporteAsistencia(token, desde, hasta, seccionId || undefined)
      .then(setReporte)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }, [token, desde, hasta, seccionId]);

  useEffect(() => {
    if (!trabajadorId) {
      setHistorico(null);
      return;
    }
    setCargandoHistorico(true);
    obtenerHistoricoTrabajador(token, trabajadorId, desde, hasta)
      .then(setHistorico)
      .catch(() => setHistorico(null))
      .finally(() => setCargandoHistorico(false));
  }, [token, trabajadorId, desde, hasta]);

  const trabajadoresFiltrados = useMemo(() => {
    const q = busquedaTrabajador.trim().toLowerCase();
    if (!q || !trabajadores) return [];
    return trabajadores.filter((t) => t.nombreCompleto.toLowerCase().includes(q)).slice(0, 8);
  }, [trabajadores, busquedaTrabajador]);

  async function exportar(formato: "pdf" | "excel") {
    try {
      await exportarAsistencia(token, desde, hasta, formato, seccionId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar.");
    }
  }

  return (
    <div>
      <div className="tarjeta-admin" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Desde
          <CampoFecha value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Hasta
          <CampoFecha value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Sección
          <select value={seccionId} onChange={(e) => setSeccionId(e.target.value)} style={{ ...estilosCampo, minWidth: 160 }}>
            <option value="">Todas</option>
            {secciones?.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </label>
        <div style={{ marginLeft: "auto" }}>
          <BotonesExportar onExportar={exportar} />
        </div>
      </div>

      {error ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando || !reporte ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginTop: 16 }}>
            <TarjetaKPI etiqueta="Presentes" valor={reporte.resumen.presentes} />
            <TarjetaKPI etiqueta="Ausentes" valor={reporte.resumen.ausentes ?? "—"} />
            <TarjetaKPI etiqueta="Tardanzas" valor={reporte.resumen.tardanzas} />
            <TarjetaKPI etiqueta="A tiempo" valor={reporte.resumen.aTiempo} />
            <TarjetaKPI etiqueta="Puntualidad" valor={pct(reporte.resumen.porcentajePuntualidad)} />
          </div>

          <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Desglose por sección</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 20px" }}>Sección</th>
                  <th style={{ padding: "10px 12px" }}>Presentes</th>
                  <th style={{ padding: "10px 12px" }}>A tiempo</th>
                  <th style={{ padding: "10px 12px" }}>Tardanzas</th>
                  <th style={{ padding: "10px 20px" }}>Puntualidad</th>
                </tr>
              </thead>
              <tbody>
                {reporte.porSeccion.map((s) => (
                  <tr key={s.seccionId} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "10px 20px", fontWeight: 600, color: "var(--ink)" }}>{s.seccionNombre}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{s.presentes}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{s.aTiempo}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{s.tardanzas}</td>
                    <td style={{ padding: "10px 20px", color: "var(--ink)" }}>{pct(s.porcentajePuntualidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Tendencia</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", position: "sticky", top: 0, background: "var(--surface)" }}>
                    <th style={{ padding: "10px 20px" }}>Periodo</th>
                    <th style={{ padding: "10px 12px" }}>Presentes</th>
                    <th style={{ padding: "10px 12px" }}>Ausentes</th>
                    <th style={{ padding: "10px 12px" }}>Tardanzas</th>
                    <th style={{ padding: "10px 20px" }}>Puntualidad</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.tendencia.map((t, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                      <td style={{ padding: "10px 20px", color: "var(--ink)" }}>{t.etiqueta}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{t.presentes}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{t.ausentes ?? "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{t.tardanzas}</td>
                      <td style={{ padding: "10px 20px", color: "var(--ink)" }}>{pct(t.porcentajePuntualidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Histórico individual por trabajador</div>
        <input
          type="text"
          placeholder="Buscar trabajador por nombre…"
          value={busquedaTrabajador}
          onChange={(e) => {
            setBusquedaTrabajador(e.target.value);
            setTrabajadorId(null);
          }}
          style={{ ...estilosCampo, width: "100%", maxWidth: 360 }}
        />
        {trabajadoresFiltrados.length > 0 && !trabajadorId && (
          <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, maxWidth: 360, overflow: "hidden" }}>
            {trabajadoresFiltrados.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setTrabajadorId(t.id);
                  setBusquedaTrabajador(t.nombreCompleto);
                }}
                style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderTop: "1px solid var(--line)" }}
              >
                {t.nombreCompleto}
              </div>
            ))}
          </div>
        )}

        {cargandoHistorico ? (
          <div style={{ padding: "16px 0", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : historico ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              {historico.resumen.presentes} presentes · {historico.resumen.ausentes} ausentes · {historico.resumen.tardanzas} tardanzas · {pct(historico.resumen.porcentajePuntualidad)} puntualidad
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>
                    <th style={{ padding: "8px 12px" }}>Fecha</th>
                    <th style={{ padding: "8px 12px" }}>Hora</th>
                    <th style={{ padding: "8px 12px" }}>Sección</th>
                    <th style={{ padding: "8px 12px" }}>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.dias.map((d) => (
                    <tr key={d.fecha} style={{ borderTop: "1px solid var(--line)", fontSize: 13 }}>
                      <td style={{ padding: "7px 12px", color: "var(--ink)" }}>{d.fecha}</td>
                      <td style={{ padding: "7px 12px", color: "var(--muted)" }}>{d.hora ?? "—"}</td>
                      <td style={{ padding: "7px 12px", color: "var(--muted)" }}>{d.seccionNombre ?? "—"}</td>
                      <td style={{ padding: "7px 12px" }}>
                        {!d.presente ? (
                          <span style={{ color: "var(--err)", fontWeight: 600 }}>Ausente</span>
                        ) : d.aTiempo ? (
                          <span style={{ color: "var(--ok)", fontWeight: 600 }}>A tiempo</span>
                        ) : (
                          <span style={{ color: "var(--warn)", fontWeight: 600 }}>Tardanza</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PanelReporteNomina() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [desde, setDesde] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasta, setHasta] = useState(hoyISO());
  const [reporte, setReporte] = useState<ReporteNomina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerReporteNomina(token, desde, hasta)
      .then(setReporte)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }, [token, desde, hasta]);

  async function exportar(formato: "pdf" | "excel") {
    try {
      await exportarNomina(token, desde, hasta, formato);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar.");
    }
  }

  return (
    <div>
      <div className="tarjeta-admin" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Desde
          <CampoFecha value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Hasta
          <CampoFecha value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <div style={{ marginLeft: "auto" }}>
          <BotonesExportar onExportar={exportar} />
        </div>
      </div>

      {error ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando || !reporte ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 16 }}>
            <TarjetaKPI etiqueta="Total pagado" valor={moneda(reporte.resumen.totalPagado)} />
            <TarjetaKPI etiqueta="Horas extra" valor={moneda(reporte.resumen.totalHorasExtra)} />
            <TarjetaKPI etiqueta="INFONAVIT" valor={moneda(reporte.resumen.totalInfonavit)} />
            <TarjetaKPI etiqueta="Descuentos" valor={moneda(reporte.resumen.totalDescuentos)} />
          </div>

          <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Desglose por categoría</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 20px" }}>Categoría</th>
                  <th style={{ padding: "10px 12px" }}>Total pagado</th>
                  <th style={{ padding: "10px 20px" }}>Trabajadores</th>
                </tr>
              </thead>
              <tbody>
                {reporte.porCategoria.map((c) => (
                  <tr key={c.categoria} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "10px 20px", fontWeight: 600, color: "var(--ink)" }}>{c.categoria}</td>
                    <td style={{ padding: "10px 12px", color: "var(--ink)" }}>{moneda(c.totalPagado)}</td>
                    <td style={{ padding: "10px 20px", color: "var(--muted)" }}>{c.cantidadTrabajadores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Comparativo por periodo</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 20px" }}>Periodo</th>
                  <th style={{ padding: "10px 12px" }}>Total pagado</th>
                  <th style={{ padding: "10px 12px" }}>Horas extra</th>
                  <th style={{ padding: "10px 12px" }}>INFONAVIT</th>
                  <th style={{ padding: "10px 20px" }}>Descuentos</th>
                </tr>
              </thead>
              <tbody>
                {reporte.porPeriodo.map((p) => (
                  <tr key={p.periodoInicio} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "10px 20px", color: "var(--ink)" }}>{p.periodoInicio} – {p.periodoFin}</td>
                    <td style={{ padding: "10px 12px", color: "var(--ink)", fontWeight: 600 }}>{moneda(p.totalPagado)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{moneda(p.montoHorasExtra)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{moneda(p.infonavitDescuento)}</td>
                    <td style={{ padding: "10px 20px", color: "var(--muted)" }}>{moneda(p.descuentosVarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

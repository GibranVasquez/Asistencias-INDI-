import { useEffect, useMemo, useState } from "react";
import { AsistenciaListada, listarAsistencias } from "../api/asistencias";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ChipEstado from "../components/ChipEstado";
import CampoFecha from "../components/CampoFecha";

function hoyISO(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ETIQUETA_METODO: Record<string, string> = { huella: "Huella", rostro: "Rostro" };

export default function AsistenciasPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [busquedaTrabajador, setBusquedaTrabajador] = useState("");

  const [asistencias, setAsistencias] = useState<AsistenciaListada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarAsistencias(token, { fechaInicio: fechaDesde, fechaFin: fechaHasta })
      .then((r) => {
        if (!cancelado) setAsistencias(r.asistencias);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
        setAsistencias(null);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token, fechaDesde, fechaHasta]);

  // Las secciones del filtro salen de los datos ya cargados, no de un
  // catálogo aparte: recepcion puede leer /asistencias pero no /secciones,
  // así que un <select> poblado desde GET /secciones lo dejaría sin poder
  // filtrar por sección en absoluto.
  const seccionesDisponibles = useMemo(() => {
    const mapa = new Map<string, string>();
    asistencias?.forEach((a) => mapa.set(a.seccionId, a.seccionNombre));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [asistencias]);

  const asistenciasFiltradas = useMemo(() => {
    if (!asistencias) return [];
    const busqueda = busquedaTrabajador.trim().toLowerCase();
    return asistencias.filter((a) => {
      if (seccionFiltro && a.seccionId !== seccionFiltro) return false;
      if (busqueda && !a.trabajadorNombre.toLowerCase().includes(busqueda)) return false;
      return true;
    });
  }, [asistencias, seccionFiltro, busquedaTrabajador]);

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Control de asistencias</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>Historial de marcaciones</p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginTop: 20,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Desde
          <CampoFecha value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Hasta
          <CampoFecha value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Sección
          <select
            value={seccionFiltro}
            onChange={(e) => setSeccionFiltro(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, minWidth: 160, background: "var(--surface)", color: "var(--ink)" }}
          >
            <option value="">Todas</option>
            {seccionesDisponibles.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Buscar trabajador
          <input
            type="text"
            placeholder="Nombre…"
            value={busquedaTrabajador}
            onChange={(e) => setBusquedaTrabajador(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" }}
          />
        </label>
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {cargando ? "Cargando…" : `${asistenciasFiltradas.length} registro${asistenciasFiltradas.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : asistenciasFiltradas.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            Sin marcaciones en este rango/filtro.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Trabajador</th>
                  <th style={{ padding: "10px 12px" }}>Sección</th>
                  <th style={{ padding: "10px 12px" }}>Fecha</th>
                  <th style={{ padding: "10px 12px" }}>Hora</th>
                  <th style={{ padding: "10px 12px" }}>Turno</th>
                  <th style={{ padding: "10px 20px" }}>Método</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasFiltradas.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{a.trabajadorNombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--ink)" }}>{a.seccionNombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{a.fecha.slice(0, 10)}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {a.hora.slice(11, 16)}
                    </td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", textTransform: "capitalize" }}>{a.turno}</td>
                    <td style={{ padding: "11px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <ChipEstado
                          tamano={26}
                          color="indi"
                          icono={a.metodoUsado === "rostro" ? "🙂" : "👆"}
                          titulo={ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                          {ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

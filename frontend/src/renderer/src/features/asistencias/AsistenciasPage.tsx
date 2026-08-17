import { useEffect, useMemo, useState } from "react";
import { AsistenciaListada, listarAsistencias } from "@/features/asistencias/api";
import { ApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import ChipEstado from "@/shared/components/ChipEstado";
import CampoFecha from "@/shared/components/CampoFecha";
import EmptyState from "@/shared/components/EmptyState";
import PageHeader from "@/shared/components/PageHeader";
import ModuleSummary from "@/shared/components/ModuleSummary";
import SectionHeader from "@/shared/components/SectionHeader";

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

  const trabajadoresUnicos = useMemo(
    () => new Set(asistenciasFiltradas.map((a) => a.trabajadorNombre)).size,
    [asistenciasFiltradas]
  );
  const frentesVisibles = useMemo(
    () => new Set(asistenciasFiltradas.map((a) => a.seccionId)).size,
    [asistenciasFiltradas]
  );

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <PageHeader titulo="Asistencia" descripcion="Consulta y supervisa los registros de entrada y salida del personal." metadata="Monitor de operación diaria" />

      {!cargando && asistencias && (
        <ModuleSummary
          etiqueta={fechaDesde === fechaHasta ? `Jornada · ${fechaDesde}` : `Periodo · ${fechaDesde} — ${fechaHasta}`}
          icono="◷"
          items={[
            { etiqueta: "Registros visibles", valor: asistenciasFiltradas.length },
            { etiqueta: "Personal", valor: trabajadoresUnicos },
            { etiqueta: "Frentes", valor: frentesVisibles },
          ]}
        />
      )}

      <div
        className="barra-filtros"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginTop: 20,
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
          Frente
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
        <SectionHeader titulo="Detalle de asistencia" descripcion="Marcaciones registradas para los filtros seleccionados." />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {cargando ? "Cargando…" : `${asistenciasFiltradas.length} registro${asistenciasFiltradas.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando asistencia…</div>
        ) : asistenciasFiltradas.length === 0 ? (
          <EmptyState titulo="No hay marcaciones en este periodo" descripcion="Prueba cambiando las fechas, el frente o la búsqueda de trabajador." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Trabajador</th>
                  <th style={{ padding: "10px 12px" }}>Frente</th>
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

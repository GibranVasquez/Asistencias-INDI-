import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { listarTrabajadores, Trabajador, tieneDatosNominaIncompletos } from "../api/trabajadores";
import { useAuth } from "../context/AuthContext";

const ETIQUETA_TIPO: Record<string, string> = { empleado: "Empleado", contratista: "Contratista", becario: "Becario" };

export default function TrabajadoresPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;
  const navegar = useNavigate();

  const [trabajadores, setTrabajadores] = useState<Trabajador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  function cargar() {
    setCargando(true);
    setError(null);
    listarTrabajadores(token)
      .then((r) => setTrabajadores(r.trabajadores))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [token]);

  const categorias = useMemo(() => {
    if (!trabajadores) return [];
    return Array.from(new Set(trabajadores.map((t) => t.categoria))).sort((a, b) => a.localeCompare(b));
  }, [trabajadores]);

  const filtrados = useMemo(() => {
    if (!trabajadores) return [];
    const q = busqueda.trim().toLowerCase();
    return trabajadores.filter(
      (t) =>
        (!categoriaFiltro || t.categoria === categoriaFiltro) &&
        (!q || t.nombreCompleto.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q))
    );
  }, [trabajadores, busqueda, categoriaFiltro]);

  const incompletos = trabajadores?.filter(tieneDatosNominaIncompletos).length ?? 0;

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Trabajadores</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            {trabajadores ? `${trabajadores.length} en total` : "Cargando…"}
            {incompletos > 0 && (
              <span style={{ color: "var(--warn)", fontWeight: 600 }}> · {incompletos} con datos de nómina incompletos</span>
            )}
          </p>
        </div>
        <button
          onClick={() => navegar("/panel/trabajadores/nuevo")}
          style={{ padding: "11px 20px", background: "var(--indi)", color: "var(--white)", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 700 }}
        >
          + Nuevo trabajador
        </button>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por nombre o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "10px 14px",
            borderRadius: 9,
            border: "1.5px solid var(--line)",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 9,
            border: "1.5px solid var(--line)",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Sin resultados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Nombre</th>
                  <th style={{ padding: "10px 12px" }}>Categoría</th>
                  <th style={{ padding: "10px 12px" }}>Tipo</th>
                  <th style={{ padding: "10px 12px" }}>Estatus</th>
                  <th style={{ padding: "10px 12px" }}>Biometría</th>
                  <th style={{ padding: "10px 20px" }}>Nómina</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navegar(`/panel/trabajadores/${t.id}`)}
                    style={{ borderTop: "1px solid var(--line)", fontSize: 13.5, cursor: "pointer" }}
                  >
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{t.nombreCompleto}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.categoria}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{ETIQUETA_TIPO[t.tipo] ?? t.tipo}</td>
                    <td style={{ padding: "11px 12px" }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: t.estatus === "activo" ? "var(--ok)" : "var(--err)",
                          background:
                            t.estatus === "activo"
                              ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                              : "color-mix(in srgb, var(--err) 12%, transparent)",
                          padding: "3px 10px",
                          borderRadius: 999,
                        }}
                      >
                        {t.estatus === "activo" ? "Activo" : "Baja"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>
                      <span title="Huella" style={{ marginRight: 8, opacity: t.huellaRegistrada ? 1 : 0.25 }}>
                        👆
                      </span>
                      <span title="Rostro" style={{ opacity: t.rostroRegistrado ? 1 : 0.25 }}>
                        🙂
                      </span>
                    </td>
                    <td style={{ padding: "11px 20px" }}>
                      {tieneDatosNominaIncompletos(t) ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--warn)",
                            background: "color-mix(in srgb, var(--warn) 14%, transparent)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          Incompleta
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--ok)",
                            background: "color-mix(in srgb, var(--ok) 12%, transparent)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          Completa
                        </span>
                      )}
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

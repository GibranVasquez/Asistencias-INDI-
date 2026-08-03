import { Fragment, FormEvent, ReactNode, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { listarEncargados, EncargadoBasico } from "../api/encargados";
import { crearHorario, borrarHorario, DatosHorario, editarHorario, Horario, listarHorarios } from "../api/horarios";
import {
  crearSeccion,
  borrarSeccion,
  DatosAltaSeccion,
  DatosEdicionSeccion,
  editarSeccion,
  listarSecciones,
  Seccion,
} from "../api/secciones";
import { crearTarifaHoraExtra, DatosTarifaHoraExtra, listarTarifasHoraExtra, TarifaHoraExtra } from "../api/tarifasHoraExtra";
import {
  crearTipoMovimiento,
  borrarTipoMovimiento,
  DatosTipoMovimiento,
  editarTipoMovimiento,
  listarTiposMovimiento,
  TipoMovimiento,
} from "../api/tiposMovimiento";
import { useAuth } from "../context/AuthContext";

type Tab = "horarios" | "secciones" | "tiposMovimiento" | "tarifas";

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: "horarios", etiqueta: "Horarios" },
  { id: "secciones", etiqueta: "Secciones" },
  { id: "tiposMovimiento", etiqueta: "Tipos de movimiento" },
  { id: "tarifas", etiqueta: "Tarifa hora extra" },
];

const estilosCampo = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid var(--line)",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

function aHHMM(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "";
}

function hoyISO(): string {
  const a = new Date();
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
}

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 420, maxHeight: "85vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 14 }}>
      {etiqueta}
      {children}
    </label>
  );
}

function BotonesModal({ guardando, onCancelar, etiqueta }: { guardando: boolean; onCancelar: () => void; etiqueta: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
      <button type="button" onClick={onCancelar} style={{ flex: 1, padding: 11, background: "var(--surface)", border: "1.5px solid var(--line)", borderRadius: 9, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
        Cancelar
      </button>
      <button type="submit" disabled={guardando} style={{ flex: 1, padding: 11, background: "var(--indi)", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 700, color: "#fff", opacity: guardando ? 0.7 : 1 }}>
        {guardando ? "Guardando…" : etiqueta}
      </button>
    </div>
  );
}

function ErrorInline({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div style={{ fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
      {mensaje}
    </div>
  );
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("horarios");

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Configuración</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>Catálogos del sistema</p>

      <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 4, marginTop: 18, width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "9px 16px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: tab === t.id ? "var(--indi)" : "transparent",
              color: tab === t.id ? "#fff" : "var(--muted)",
              cursor: "pointer",
            }}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        {tab === "horarios" && <PanelHorarios />}
        {tab === "secciones" && <PanelSecciones />}
        {tab === "tiposMovimiento" && <PanelTiposMovimiento />}
        {tab === "tarifas" && <PanelTarifas />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------

function formularioHorarioVacio(): DatosHorario {
  return { nombre: "", horaEntrada: "08:00", horaSalida: "17:00", toleranciaMinutos: 10, recesoInicio: "", recesoFin: "" };
}

function PanelHorarios() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: Horario | null } | null>(null);
  const [formulario, setFormulario] = useState<DatosHorario>(formularioHorarioVacio());
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});

  function cargar() {
    setCargando(true);
    setError(null);
    listarHorarios(token)
      .then((r) => setHorarios(r.horarios))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setFormulario(formularioHorarioVacio());
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(h: Horario) {
    setFormulario({
      nombre: h.nombre,
      horaEntrada: aHHMM(h.horaEntrada),
      horaSalida: aHHMM(h.horaSalida),
      toleranciaMinutos: h.toleranciaMinutos,
      recesoInicio: aHHMM(h.recesoInicio) || "",
      recesoFin: aHHMM(h.recesoFin) || "",
    });
    setErrorModal(null);
    setModal({ editando: h });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    const datos: DatosHorario = {
      ...formulario,
      recesoInicio: formulario.recesoInicio || null,
      recesoFin: formulario.recesoFin || null,
    };
    try {
      if (modal?.editando) {
        await editarHorario(token, modal.editando.id, datos);
      } else {
        await crearHorario(token, datos);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(h: Horario) {
    setErroresFila((p) => ({ ...p, [h.id]: "" }));
    try {
      await borrarHorario(token, h.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [h.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
    }
  }

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{horarios ? `${horarios.length} horario${horarios.length === 1 ? "" : "s"}` : "Cargando…"}</span>
        <button onClick={abrirAlta} style={{ padding: "9px 16px", background: "var(--indi)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
          + Nuevo horario
        </button>
      </div>

      {error ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Entrada</th>
                <th style={{ padding: "10px 12px" }}>Salida</th>
                <th style={{ padding: "10px 12px" }}>Receso</th>
                <th style={{ padding: "10px 12px" }}>Tolerancia</th>
                <th style={{ padding: "10px 12px" }}>Secciones que lo usan</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {horarios?.map((h) => (
                <Fragment key={h.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{h.nombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{aHHMM(h.horaEntrada)}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{aHHMM(h.horaSalida)}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {h.recesoInicio && h.recesoFin ? `${aHHMM(h.recesoInicio)}–${aHHMM(h.recesoFin)}` : "—"}
                    </td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{h.toleranciaMinutos} min</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{h.secciones?.length ? h.secciones.map((s) => s.nombre).join(", ") : "—"}</td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <button onClick={() => abrirEdicion(h)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>
                        Editar
                      </button>
                      <button onClick={() => borrar(h)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--err)", fontSize: 12, fontWeight: 700 }}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                  {erroresFila[h.id] && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[h.id]}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <form onSubmit={enviar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar horario" : "Nuevo horario"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} style={estilosCampo} />
            </Campo>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Hora de entrada">
                  <input type="time" required value={formulario.horaEntrada} onChange={(e) => setFormulario((f) => ({ ...f, horaEntrada: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Hora de salida">
                  <input type="time" required value={formulario.horaSalida} onChange={(e) => setFormulario((f) => ({ ...f, horaSalida: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Receso inicio (opcional)">
                  <input type="time" value={formulario.recesoInicio ?? ""} onChange={(e) => setFormulario((f) => ({ ...f, recesoInicio: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Receso fin (opcional)">
                  <input type="time" value={formulario.recesoFin ?? ""} onChange={(e) => setFormulario((f) => ({ ...f, recesoFin: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
            </div>
            <Campo etiqueta="Tolerancia (minutos)">
              <input
                type="number"
                min={0}
                required
                value={formulario.toleranciaMinutos}
                onChange={(e) => setFormulario((f) => ({ ...f, toleranciaMinutos: Number(e.target.value) }))}
                style={estilosCampo}
              />
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear horario"} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------

function PanelSecciones() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [encargados, setEncargados] = useState<EncargadoBasico[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: Seccion | null } | null>(null);
  const [nombre, setNombre] = useState("");
  const [horarioId, setHorarioId] = useState("");
  const [encargadoIds, setEncargadoIds] = useState<string[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});

  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([listarSecciones(token), listarHorarios(token), listarEncargados(token)])
      .then(([s, h, e]) => {
        setSecciones(s.secciones);
        setHorarios(h.horarios);
        setEncargados(e.usuarios);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setNombre("");
    setHorarioId("");
    setEncargadoIds([]);
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(s: Seccion) {
    setNombre(s.nombre);
    setHorarioId(s.horarioId ?? "");
    setEncargadoIds(s.encargados?.map((e) => e.id) ?? []);
    setErrorModal(null);
    setModal({ editando: s });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      if (modal?.editando) {
        const datos: DatosEdicionSeccion = { nombre, horarioId: horarioId || null, encargadoIds };
        await editarSeccion(token, modal.editando.id, datos);
      } else {
        // Un único Obra en todo el sistema hoy (Tren Golfo de México); no
        // existe GET /obras, así que se reutiliza el obraId de una sección
        // ya existente en vez de construir un endpoint nuevo para esto.
        const obraId = secciones?.[0]?.obraId;
        if (!obraId) {
          throw new Error("No se pudo determinar la obra: crea la primera sección directamente en la base o contacta soporte.");
        }
        const datos: DatosAltaSeccion = { obraId, nombre, horarioId: horarioId || null, encargadoIds };
        await crearSeccion(token, datos);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(s: Seccion) {
    setErroresFila((p) => ({ ...p, [s.id]: "" }));
    try {
      await borrarSeccion(token, s.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [s.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
    }
  }

  const mapaHorarios = new Map((horarios ?? []).map((h) => [h.id, h.nombre]));

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{secciones ? `${secciones.length} sección${secciones.length === 1 ? "" : "es"}` : "Cargando…"}</span>
        <button onClick={abrirAlta} style={{ padding: "9px 16px", background: "var(--indi)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
          + Nueva sección
        </button>
      </div>

      {error ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Horario</th>
                <th style={{ padding: "10px 12px" }}>Encargado(s)</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {secciones?.map((s) => (
                <Fragment key={s.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{s.nombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{s.horarioId ? mapaHorarios.get(s.horarioId) ?? "—" : "—"}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{s.encargados?.length ? s.encargados.map((e) => e.username).join(", ") : "—"}</td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <button onClick={() => abrirEdicion(s)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>
                        Editar
                      </button>
                      <button onClick={() => borrar(s)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--err)", fontSize: 12, fontWeight: 700 }}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                  {erroresFila[s.id] && (
                    <tr>
                      <td colSpan={4} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[s.id]}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <form onSubmit={enviar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar sección" : "Nueva sección"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} style={estilosCampo} />
            </Campo>
            <Campo etiqueta="Horario asignado">
              <select value={horarioId} onChange={(e) => setHorarioId(e.target.value)} style={estilosCampo}>
                <option value="">Sin horario</option>
                {horarios?.map((h) => (
                  <option key={h.id} value={h.id}>{h.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Encargados">
              <select
                multiple
                value={encargadoIds}
                onChange={(e) => setEncargadoIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                style={{ ...estilosCampo, minHeight: 90 }}
              >
                {encargados?.map((en) => (
                  <option key={en.id} value={en.id}>{en.username}</option>
                ))}
              </select>
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear sección"} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tipos de movimiento
// ---------------------------------------------------------------------

function formularioTipoVacio(): DatosTipoMovimiento {
  return { nombre: "", cuentaComoDiaTrabajado: false, esInformativo: false, requiereAutorizacion: false };
}

function Check({ etiqueta, checked, onChange }: { etiqueta: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--indi2)" }} />
      {etiqueta}
    </label>
  );
}

function Pill({ activo, etiquetaSi = "Sí", etiquetaNo = "—" }: { activo: boolean; etiquetaSi?: string; etiquetaNo?: string }) {
  if (!activo) return <span style={{ color: "var(--muted)" }}>{etiquetaNo}</span>;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ok)", background: "rgba(47,174,102,.12)", padding: "3px 10px", borderRadius: 999 }}>
      {etiquetaSi}
    </span>
  );
}

function PanelTiposMovimiento() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [tipos, setTipos] = useState<TipoMovimiento[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: TipoMovimiento | null } | null>(null);
  const [formulario, setFormulario] = useState<DatosTipoMovimiento>(formularioTipoVacio());
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});

  function cargar() {
    setCargando(true);
    setError(null);
    listarTiposMovimiento(token)
      .then((r) => setTipos(r.tiposMovimiento))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setFormulario(formularioTipoVacio());
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(t: TipoMovimiento) {
    setFormulario({ nombre: t.nombre, cuentaComoDiaTrabajado: t.cuentaComoDiaTrabajado, esInformativo: t.esInformativo, requiereAutorizacion: t.requiereAutorizacion });
    setErrorModal(null);
    setModal({ editando: t });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      if (modal?.editando) {
        await editarTipoMovimiento(token, modal.editando.id, formulario);
      } else {
        await crearTipoMovimiento(token, formulario);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(t: TipoMovimiento) {
    setErroresFila((p) => ({ ...p, [t.id]: "" }));
    try {
      await borrarTipoMovimiento(token, t.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [t.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
    }
  }

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{tipos ? `${tipos.length} tipo${tipos.length === 1 ? "" : "s"}` : "Cargando…"}</span>
        <button onClick={abrirAlta} style={{ padding: "9px 16px", background: "var(--indi)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
          + Nuevo tipo
        </button>
      </div>

      {error ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Cuenta como día trabajado</th>
                <th style={{ padding: "10px 12px" }}>Informativo</th>
                <th style={{ padding: "10px 12px" }}>Requiere autorización</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tipos?.map((t) => (
                <Fragment key={t.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{t.nombre}</td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.cuentaComoDiaTrabajado} /></td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.esInformativo} /></td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.requiereAutorizacion} /></td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <button onClick={() => abrirEdicion(t)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>
                        Editar
                      </button>
                      <button onClick={() => borrar(t)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--err)", fontSize: 12, fontWeight: 700 }}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                  {erroresFila[t.id] && (
                    <tr>
                      <td colSpan={5} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[t.id]}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal onClose={() => setModal(null)}>
          <form onSubmit={enviar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar tipo de movimiento" : "Nuevo tipo de movimiento"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} style={estilosCampo} />
            </Campo>
            <Check etiqueta="Cuenta como día trabajado" checked={formulario.cuentaComoDiaTrabajado} onChange={(v) => setFormulario((f) => ({ ...f, cuentaComoDiaTrabajado: v }))} />
            <Check etiqueta="Es informativo" checked={formulario.esInformativo} onChange={(v) => setFormulario((f) => ({ ...f, esInformativo: v }))} />
            <Check etiqueta="Requiere autorización" checked={formulario.requiereAutorizacion} onChange={(v) => setFormulario((f) => ({ ...f, requiereAutorizacion: v }))} />
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear tipo"} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tarifa hora extra
// ---------------------------------------------------------------------

function PanelTarifas() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [tarifas, setTarifas] = useState<TarifaHoraExtra[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [formulario, setFormulario] = useState<DatosTarifaHoraExtra>({ valor: 0, vigenteDesde: hoyISO() });
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    setCargando(true);
    setError(null);
    listarTarifasHoraExtra(token)
      .then((r) => setTarifas(r.tarifas))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  // La vigente es la de vigenteDesde más reciente que ya haya empezado
  // (<=hoy) — misma regla que calcularMontoHorasExtra en el backend.
  const idVigente = (() => {
    if (!tarifas) return null;
    const hoy = hoyISO();
    const candidatas = tarifas.filter((t) => t.vigenteDesde.slice(0, 10) <= hoy);
    if (candidatas.length === 0) return null;
    return candidatas.reduce((a, b) => (a.vigenteDesde > b.vigenteDesde ? a : b)).id;
  })();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      await crearTarifaHoraExtra(token, formulario);
      setModal(false);
      setFormulario({ valor: 0, vigenteDesde: hoyISO() });
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(46,99,199,.1)", color: "var(--indi2)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
        Esto es un historial (append-only), no un valor único que se edita. Cada alta agrega una tarifa nueva vigente desde una fecha;
        una tarifa ya usada en una nómina generada no se puede editar ni borrar.
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{tarifas ? `${tarifas.length} tarifa${tarifas.length === 1 ? "" : "s"} en el historial` : "Cargando…"}</span>
          <button onClick={() => { setFormulario({ valor: 0, vigenteDesde: hoyISO() }); setErrorModal(null); setModal(true); }} style={{ padding: "9px 16px", background: "var(--indi)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            + Nueva tarifa
          </button>
        </div>

        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : tarifas?.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Sin tarifas registradas todavía.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Valor por hora</th>
                <th style={{ padding: "10px 12px" }}>Vigente desde</th>
                <th style={{ padding: "10px 20px" }}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {tarifas?.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                  <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>${Number(t.valor).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.vigenteDesde.slice(0, 10)}</td>
                  <td style={{ padding: "11px 20px" }}>
                    {t.id === idVigente ? (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ok)", background: "rgba(47,174,102,.12)", padding: "3px 10px", borderRadius: 999 }}>Vigente actualmente</span>
                    ) : (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--pastel)", padding: "3px 10px", borderRadius: 999 }}>Histórica</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal onClose={() => setModal(false)}>
          <form onSubmit={enviar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>Nueva tarifa de hora extra</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Valor por hora">
              <input type="number" min={0.01} step="0.01" required value={formulario.valor} onChange={(e) => setFormulario((f) => ({ ...f, valor: Number(e.target.value) }))} style={estilosCampo} />
            </Campo>
            <Campo etiqueta="Vigente desde">
              <input type="date" required value={formulario.vigenteDesde} onChange={(e) => setFormulario((f) => ({ ...f, vigenteDesde: e.target.value }))} style={estilosCampo} />
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(false)} etiqueta="Crear tarifa" />
          </form>
        </Modal>
      )}
    </div>
  );
}

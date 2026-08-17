import { useCallback, useEffect, useMemo, useState } from "react";
import {
  asignarSeccionDelDia,
  obtenerResumenHoy,
  obtenerSugerencia,
  ResumenSeccionHoy,
  TrabajadorMovido,
} from "@/features/encargado/asignacionesApi";
import { AsistenciaListada, listarAsistencias } from "@/features/asistencias/api";
import { ApiError } from "@/core/api/client";
import { listarSecciones, Seccion } from "@/core/api/resources/secciones";
import { listarTrabajadoresBasico, TrabajadorBasico } from "@/features/trabajadores/api";
import { useAuth } from "@/features/auth/AuthContext";
import TarjetaKPI from "@/shared/components/TarjetaKPI";
import Boton from "@/shared/components/Boton";
import PageHeader from "@/shared/components/PageHeader";

const INTERVALO_POLL_MS = 20_000;

function aFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  copia.setDate(copia.getDate() + (dia === 0 ? -6 : 1 - dia));
  return copia;
}

function contarDiasHabiles(inicio: Date, fin: Date): number {
  let cuenta = 0;
  for (let cursor = new Date(inicio); cursor <= fin; cursor.setDate(cursor.getDate() + 1)) {
    const dia = cursor.getDay();
    if (dia !== 0 && dia !== 6) cuenta++;
  }
  return cuenta;
}

export default function EncargadoPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;
  const rol = sesion!.usuario.rol;
  const [resumen, setResumen] = useState<ResumenSeccionHoy | null>(null);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(true);
  const [modoCarga, setModoCarga] = useState(false);
  const [avisoMovidos, setAvisoMovidos] = useState<TrabajadorMovido[] | null>(null);

  // rh puede ver cualquier seccion (GET /secciones); encargado_seccion solo
  // las suyas, ya traidas en la sesion (ver auth.service.ts en el backend).
  const [seccionesRh, setSeccionesRh] = useState<Seccion[] | null>(null);
  useEffect(() => {
    if (rol === "rh") {
      listarSecciones(token)
        .then((r) => setSeccionesRh(r.secciones))
        .catch((err) => {
          setSeccionesRh([]);
          setErrorResumen(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
          setCargandoResumen(false);
        });
    }
  }, [rol, token]);

  const seccionesDisponibles = useMemo(
    () =>
      rol === "rh"
        ? (seccionesRh ?? []).map((s) => ({ id: s.id, nombre: s.nombre }))
        : sesion!.usuario.seccionesAsignadas,
    [rol, seccionesRh, sesion]
  );

  const [seccionId, setSeccionId] = useState<string | null>(null);
  useEffect(() => {
    if (!seccionId && seccionesDisponibles.length > 0) {
      setSeccionId(seccionesDisponibles[0].id);
    }
  }, [seccionesDisponibles, seccionId]);

  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cargarResumen = useCallback(() => {
    if (!seccionId) return;
    setErrorResumen(null);
    obtenerResumenHoy(token, seccionId)
      .then((r) => setResumen(r))
      .catch((err) => setErrorResumen(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargandoResumen(false));
  }, [token, seccionId]);

  useEffect(() => {
    setCargandoResumen(true);
    setResumen(null);
    cargarResumen();
  }, [seccionId, cargarResumen]);

  // Refresco "en vivo" — pausado mientras se esta editando la asignacion
  // para no pisar lo que el encargado esta armando.
  useEffect(() => {
    if (modoCarga) return;
    const id = setInterval(cargarResumen, INTERVALO_POLL_MS);
    return () => clearInterval(id);
  }, [modoCarga, cargarResumen]);

  // % de asistencia de la semana: aproximado. No hay endpoint de asignaciones
  // historicas (solo "hoy") — se usa el total asignado HOY como referencia
  // de cuanta gente se espera por dia habil, y se compara contra las
  // marcaciones reales de la semana. Etiquetado como aproximado en la UI.
  const [asistenciasSemana, setAsistenciasSemana] = useState<AsistenciaListada[] | null>(null);
  useEffect(() => {
    if (!seccionId) return;
    const hoy = new Date();
    const inicio = inicioDeSemana(hoy);
    listarAsistencias(token, { seccionId, fechaInicio: aFechaISO(inicio), fechaFin: aFechaISO(hoy) })
      .then((r) => setAsistenciasSemana(r.asistencias))
      .catch(() => setAsistenciasSemana(null));
  }, [token, seccionId, resumen?.fecha]);

  const porcentajeSemana = useMemo(() => {
    if (!asistenciasSemana || !resumen || resumen.totalAsignado === null) return null;
    const hoy = new Date();
    const diasHabiles = contarDiasHabiles(inicioDeSemana(hoy), hoy);
    if (diasHabiles === 0 || resumen.totalAsignado === 0) return null;
    const esperado = resumen.totalAsignado * diasHabiles;
    return Math.min(100, Math.round((asistenciasSemana.length / esperado) * 100));
  }, [asistenciasSemana, resumen]);

  const nombreSeccion = seccionesDisponibles.find((s) => s.id === seccionId)?.nombre ?? "";

  async function confirmarAsignacion(trabajadorIds: string[]) {
    if (!seccionId) return;
    const resultado = await asignarSeccionDelDia(token, {
      seccionId,
      fecha: aFechaISO(new Date()),
      trabajadorIds,
    });
    setModoCarga(false);
    setAvisoMovidos(resultado.movidos.length > 0 ? resultado.movidos : null);
    cargarResumen();
  }

  if (seccionesDisponibles.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        {rol === "rh" && seccionesRh === null
          ? "Cargando…"
          : "No tienes ningún frente asignado todavía. Contacta a RH."}
      </div>
    );
  }

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <PageHeader
        titulo="Mi frente · hoy"
        descripcion="Supervisa el personal y la asistencia correspondiente a tu área de responsabilidad."
        metadata="Supervisión operativa"
        accion={<div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 32, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
            {ahora.toLocaleTimeString("es-MX", { hour12: false })}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", textTransform: "capitalize" }}>
            {ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>}
      />
      <div className="module-context-control">
        <div>
          <span className="module-context-label">Frente asignado</span>
          {seccionesDisponibles.length > 1 ? (
            <select
              value={seccionId ?? ""}
              onChange={(e) => setSeccionId(e.target.value)}
              style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 14, fontWeight: 600, background: "var(--surface)", color: "var(--ink)" }}
            >
              {seccionesDisponibles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : (
            <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 700, marginTop: 4 }}>{nombreSeccion}</p>
          )}
        </div>
      </div>

      {avisoMovidos && (
        <div
          style={{
            marginTop: 16,
            fontSize: 13.5,
            color: "var(--indi)",
            background: "rgba(46,99,199,.1)",
            border: "1px solid rgba(46,99,199,.25)",
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            {agruparAvisoMovidos(avisoMovidos)}
          </span>
          <button onClick={() => setAvisoMovidos(null)} style={{ background: "none", border: "none", color: "var(--indi2)", fontWeight: 700 }}>
            ✕
          </button>
        </div>
      )}

      {cargandoResumen ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>Cargando…</div>
      ) : errorResumen ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--err)" }}>{errorResumen}</div>
      ) : !resumen ? null : resumen.sinAsignacion ? (
        <EstadoSinAsignacion onCargar={() => setModoCarga(true)} />
      ) : (
        <VistaConAsignacion resumen={resumen} porcentajeSemana={porcentajeSemana} onReconfigurar={() => setModoCarga(true)} />
      )}

      {modoCarga && seccionId && (
        <PanelCargarAsignacion
          token={token}
          seccionId={seccionId}
          onCancelar={() => setModoCarga(false)}
          onConfirmar={confirmarAsignacion}
        />
      )}
    </div>
  );
}

function agruparAvisoMovidos(movidos: TrabajadorMovido[]): string {
  const porSeccion = new Map<string, number>();
  movidos.forEach((m) => porSeccion.set(m.seccionAnteriorNombre, (porSeccion.get(m.seccionAnteriorNombre) ?? 0) + 1));
  const partes = [...porSeccion.entries()].map(
    ([nombre, cuenta]) => `${cuenta} trabajador${cuenta === 1 ? "" : "es"} desde ${nombre}`
  );
  return `Se movieron ${partes.join(", ")}.`;
}

function EstadoSinAsignacion({ onCargar }: { onCargar: () => void }) {
  return (
    <div
      className="modal-backdrop"
      style={{
        marginTop: 30,
        background: "var(--surface)",
        border: "1px dashed var(--line)",
        borderRadius: 14,
        padding: "50px 30px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>📋</div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginTop: 12 }}>Sin asignación cargada hoy</h2>
      <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, maxWidth: 380, marginInline: "auto" }}>
        Todavía no se ha cargado la lista de trabajadores esperados hoy en este frente. Las marcaciones reales de
        hoy no se pierden — se pueden ver en cuanto cargues la asignación.
      </p>
      <Boton onClick={onCargar} style={{ marginTop: 18 }}>
        Cargar asignación de hoy
      </Boton>
    </div>
  );
}

function VistaConAsignacion({
  resumen,
  porcentajeSemana,
  onReconfigurar,
}: {
  resumen: ResumenSeccionHoy;
  porcentajeSemana: number | null;
  onReconfigurar: () => void;
}) {
  const totalAusentes = resumen.ausentes?.length ?? 0;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginTop: 22 }}>
        <TarjetaKPI etiqueta="Presentes" valor={resumen.presentes.length} color="var(--ok)" fondo="rgba(47,174,102,.12)" />
        <TarjetaKPI etiqueta="Ausentes" valor={totalAusentes} color="var(--err)" fondo="rgba(229,72,77,.12)" />
        <TarjetaKPI
          etiqueta="Asistencia (semana, aprox.)"
          valor={porcentajeSemana === null ? "…" : `${porcentajeSemana}%`}
          color="var(--indi2)"
          fondo="rgba(46,99,199,.12)"
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button onClick={onReconfigurar} style={{ background: "none", border: "none", color: "var(--indi2)", fontSize: 12.5, fontWeight: 600 }}>
          ↻ Recargar asignación de hoy
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
        <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>Presentes</h3>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ok)", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 0 3px rgba(47,174,102,.2)" }} />
              En vivo
            </span>
          </div>
          {resumen.presentes.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nadie ha marcado todavía.</p>
          ) : (
            resumen.presentes.map((p) => (
              <div key={p.trabajadorId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{p.nombreCompleto}</div>
                  {!p.asignado && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--warn)", background: "rgba(242,169,59,.14)", padding: "2px 7px", borderRadius: 999 }}>
                      No asignado aquí
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 13, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{p.hora.slice(0, 5)}</span>
              </div>
            ))
          )}
        </div>

        <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            Ausentes {resumen.totalAsignado !== null && `(de ${resumen.totalAsignado} asignados)`}
          </h3>
          {totalAusentes === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Todos los asignados ya marcaron.</p>
          ) : (
            resumen.ausentes!.map((a) => (
              <div key={a.trabajadorId} style={{ padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                {a.nombreCompleto}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function PanelCargarAsignacion({
  token,
  seccionId,
  onCancelar,
  onConfirmar,
}: {
  token: string;
  seccionId: string;
  onCancelar: () => void;
  onConfirmar: (trabajadorIds: string[]) => Promise<void>;
}) {
  const [lista, setLista] = useState<{ id: string; nombreCompleto: string }[] | null>(null);
  const [fechaSugerida, setFechaSugerida] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<TrabajadorBasico[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const hoy = aFechaISO(new Date());
    Promise.all([obtenerSugerencia(token, seccionId, hoy), listarTrabajadoresBasico(token)])
      .then(([sugerencia, trabajadores]) => {
        if (cancelado) return;
        setLista(sugerencia.trabajadores);
        setFechaSugerida(sugerencia.fechaSugerida);
        setCatalogo(trabajadores.trabajadores);
      })
      .catch((err) => {
        if (cancelado) return;
        setLista([]);
        setCatalogo([]);
        setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
      });
    return () => { cancelado = true; };
  }, [token, seccionId]);

  const idsEnLista = useMemo(() => new Set((lista ?? []).map((t) => t.id)), [lista]);
  const resultadosBusqueda = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q || !catalogo) return [];
    return catalogo
      .filter((t) => t.estatus === "activo" && !idsEnLista.has(t.id) && t.nombreCompleto.toLowerCase().includes(q))
      .slice(0, 8);
  }, [busqueda, catalogo, idsEnLista]);

  function agregar(t: TrabajadorBasico) {
    setLista((l) => [...(l ?? []), { id: t.id, nombreCompleto: t.nombreCompleto }]);
    setBusqueda("");
  }

  function quitar(id: string) {
    setLista((l) => (l ?? []).filter((t) => t.id !== id));
  }

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar((lista ?? []).map((t) => t.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
      setGuardando(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,30,61,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div className="modal-panel" style={{ background: "var(--surface)", borderRadius: 16, padding: 26, width: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Cargar asignación de hoy</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
          {lista === null
            ? "Cargando sugerencia…"
            : fechaSugerida
              ? `Pre-llenado con lo asignado el ${fechaSugerida} (último día hábil). Ajusta antes de confirmar.`
              : "Sin sugerencia disponible — arma la lista desde cero."}
        </p>

        <div style={{ marginTop: 14, position: "relative" }}>
          <input
            type="text"
            placeholder="Agregar trabajador por nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" }}
          />
          {resultadosBusqueda.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, marginTop: 4, zIndex: 1, boxShadow: "0 8px 20px rgba(0,0,0,.15)" }}>
              {resultadosBusqueda.map((t) => (
                <button
                  key={t.id}
                  onClick={() => agregar(t)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", fontSize: 13, color: "var(--ink)" }}
                >
                  {t.nombreCompleto}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, overflowY: "auto", flex: 1 }}>
          {lista === null ? (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 20 }}>Cargando…</p>
          ) : lista.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 20 }}>Lista vacía.</p>
          ) : (
            lista.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{t.nombreCompleto}</span>
                <button onClick={() => quitar(t.id)} style={{ background: "none", border: "none", color: "var(--err)", fontSize: 12, fontWeight: 700 }}>
                  Quitar
                </button>
              </div>
            ))
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--err)", background: "rgba(229,72,77,.1)", borderRadius: 8, padding: "8px 10px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Boton onClick={confirmar} disabled={guardando || lista === null} style={{ flex: 1 }}>
            {guardando ? "Guardando…" : `Confirmar (${lista?.length ?? 0})`}
          </Boton>
          <Boton variante="outline" onClick={onCancelar}>
            Cancelar
          </Boton>
        </div>
      </div>
    </div>
  );
}

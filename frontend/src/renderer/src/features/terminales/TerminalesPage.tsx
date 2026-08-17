import { Fragment, FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import {
  crearTerminal,
  DatosAltaTerminal,
  DatosEdicionTerminal,
  editarTerminal,
  listarTerminales,
  Terminal,
} from "@/features/terminales/api";
import { useAuth } from "@/features/auth/AuthContext";
import Boton from "@/shared/components/Boton";
import EmptyState from "@/shared/components/EmptyState";
import PageHeader from "@/shared/components/PageHeader";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import ModuleSummary from "@/shared/components/ModuleSummary";
import SectionHeader from "@/shared/components/SectionHeader";

const estilosCampo = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid var(--line)",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};

// 24h: mismo umbral que PanelPrincipalPage.tsx usa para el banner de inactividad
// del lector ADMS — aquí solo se muestra como dato en la fila, la alerta
// visible vive en el panel principal.
const UMBRAL_HORAS_INACTIVIDAD_ADMS = 24;

function horasDesdeSincronizacion(ultimaSincronizacion: string | null): number | null {
  if (!ultimaSincronizacion) return null;
  return (Date.now() - new Date(ultimaSincronizacion).getTime()) / 3_600_000;
}

function formularioAltaVacio(): DatosAltaTerminal {
  return { username: "", password: "", tipo: "", ubicacion: "", numeroSerie: "" };
}

export default function TerminalesPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [terminales, setTerminales] = useState<Terminal[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [formularioAlta, setFormularioAlta] = useState<DatosAltaTerminal>(formularioAltaVacio());
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  const [editando, setEditando] = useState<Terminal | null>(null);
  const [formularioEdicion, setFormularioEdicion] = useState<DatosEdicionTerminal>({});
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [filaEnProceso, setFilaEnProceso] = useState<string | null>(null);
  const [confirmandoActivo, setConfirmandoActivo] = useState<Terminal | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    listarTerminales(token)
      .then((r) => setTerminales(r.terminales))
      .catch((err) => {
        const mensaje =
          err instanceof ApiError ? (err.status === 403 ? "no disponible para tu rol" : err.message) : "No se pudo conectar con el servidor.";
        setError(mensaje);
      })
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [token]);

  async function enviarAlta(e: FormEvent) {
    e.preventDefault();
    setErrorAlta(null);
    setGuardandoAlta(true);
    try {
      await crearTerminal(token, {
        username: formularioAlta.username,
        password: formularioAlta.tipo === "adms" ? undefined : formularioAlta.password,
        tipo: formularioAlta.tipo,
        ubicacion: formularioAlta.ubicacion,
        numeroSerie: formularioAlta.numeroSerie || null,
      });
      setMostrarAlta(false);
      setFormularioAlta(formularioAltaVacio());
      cargar();
    } catch (err) {
      setErrorAlta(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardandoAlta(false);
    }
  }

  async function enviarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErrorEdicion(null);
    setGuardandoEdicion(true);
    try {
      await editarTerminal(token, editando.id, formularioEdicion);
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorEdicion(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function alternarActivo(t: Terminal) {
    setErroresFila((prev) => ({ ...prev, [t.id]: "" }));
    setFilaEnProceso(t.id);
    try {
      await editarTerminal(token, t.id, { activo: !t.activo });
      cargar();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.";
      setErroresFila((prev) => ({ ...prev, [t.id]: mensaje }));
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un fallo cerraba el
      // modal igual, dando sensación de éxito.
      throw err;
    } finally {
      setFilaEnProceso(null);
    }
  }

  const terminalesActivas = terminales?.filter((t) => t.activo).length ?? 0;
  const terminalesAdms = terminales?.filter((t) => t.tipo === "adms").length ?? 0;

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <PageHeader titulo="Terminales" descripcion="Administra dispositivos autorizados para la operación de asistencia." metadata="Gestión de dispositivos" accion={<Boton
          onClick={() => {
            setFormularioAlta(formularioAltaVacio());
            setErrorAlta(null);
            setMostrarAlta(true);
          }}
        >
          + Nuevo terminal
        </Boton>} />

      {terminales && (
        <ModuleSummary
          etiqueta="Infraestructura de asistencia"
          icono="▣"
          items={[
            { etiqueta: "Registradas", valor: terminales.length },
            { etiqueta: "Activas", valor: terminalesActivas, tono: "ok" },
            { etiqueta: "Inactivas", valor: terminales.length - terminalesActivas, tono: terminales.length > terminalesActivas ? "warn" : "neutral" },
            { etiqueta: "Dispositivos ADMS", valor: terminalesAdms },
          ]}
        />
      )}

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        <SectionHeader titulo="Dispositivos autorizados" descripcion="Vinculación, ubicación y estado de las terminales registradas." />
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando terminales…</div>
        ) : terminales?.length === 0 ? (
          <EmptyState titulo="No hay terminales registradas" descripcion="Las terminales dadas de alta aparecerán aquí con su estado de conexión." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Usuario</th>
                  <th style={{ padding: "10px 12px" }}>Tipo</th>
                  <th style={{ padding: "10px 12px" }}>Ubicación</th>
                  <th style={{ padding: "10px 12px" }}>Conexión</th>
                  <th style={{ padding: "10px 12px" }}>Última sincronización</th>
                  <th style={{ padding: "10px 12px" }}>Estatus</th>
                  <th style={{ padding: "10px 20px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {terminales?.map((t) => {
                  const horas = horasDesdeSincronizacion(t.ultimaSincronizacion);
                  const inactivo = t.tipo === "adms" && (horas === null || horas > UMBRAL_HORAS_INACTIVIDAD_ADMS);
                  return (
                    <Fragment key={t.id}>
                      <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                        <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{t.username}</td>
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.tipo}</td>
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.ubicacion}</td>
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.estadoConexion}</td>
                        <td style={{ padding: "11px 12px", color: inactivo ? "var(--err)" : "var(--muted)" }}>
                          {t.ultimaSincronizacion ? new Date(t.ultimaSincronizacion).toLocaleString("es-MX") : "—"}
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: t.activo ? "var(--ok)" : "var(--err)",
                              background: t.activo
                                ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                                : "color-mix(in srgb, var(--err) 12%, transparent)",
                              padding: "3px 10px",
                              borderRadius: 999,
                            }}
                          >
                            {t.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                          <Boton
                            variante="outline"
                            tamano="pequeno"
                            onClick={() => {
                              setEditando(t);
                              setFormularioEdicion({ ubicacion: t.ubicacion, numeroSerie: t.numeroSerie });
                              setErrorEdicion(null);
                            }}
                          >
                            Editar
                          </Boton>
                          <Boton
                            variante="outline"
                            tamano="pequeno"
                            onClick={() => setConfirmandoActivo(t)}
                            disabled={filaEnProceso === t.id}
                            style={{ color: t.activo ? "var(--err)" : "var(--ok)" }}
                          >
                            {filaEnProceso === t.id ? "…" : t.activo ? "Desactivar" : "Activar"}
                          </Boton>
                        </td>
                      </tr>
                      {erroresFila[t.id] && (
                        <tr>
                          <td colSpan={7} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>
                            {erroresFila[t.id]}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarAlta && (
        <div
          className="modal-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setMostrarAlta(false)}
        >
          <form
            className="modal-panel"
            onSubmit={enviarAlta}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 380, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Nuevo terminal</h2>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Usuario
              <input
                type="text"
                required
                value={formularioAlta.username}
                onChange={(e) => setFormularioAlta((f) => ({ ...f, username: e.target.value }))}
                style={estilosCampo}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Tipo
              <input
                type="text"
                required
                placeholder="huella, rostro, adms…"
                value={formularioAlta.tipo}
                onChange={(e) => setFormularioAlta((f) => ({ ...f, tipo: e.target.value }))}
                style={estilosCampo}
              />
            </label>

            {formularioAlta.tipo !== "adms" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Contraseña
                <input
                  type="password"
                  required
                  value={formularioAlta.password}
                  onChange={(e) => setFormularioAlta((f) => ({ ...f, password: e.target.value }))}
                  style={estilosCampo}
                />
              </label>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Ubicación
              <input
                type="text"
                required
                value={formularioAlta.ubicacion}
                onChange={(e) => setFormularioAlta((f) => ({ ...f, ubicacion: e.target.value }))}
                style={estilosCampo}
              />
            </label>

            {formularioAlta.tipo === "adms" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Número de serie
                <input
                  type="text"
                  value={formularioAlta.numeroSerie ?? ""}
                  onChange={(e) => setFormularioAlta((f) => ({ ...f, numeroSerie: e.target.value }))}
                  style={estilosCampo}
                />
              </label>
            )}

            {errorAlta && (
              <div style={{ fontSize: 13, color: "var(--err)", background: "color-mix(in srgb, var(--err) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--err) 25%, transparent)", borderRadius: 8, padding: "10px 12px" }}>
                {errorAlta}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Boton variante="outline" type="button" onClick={() => setMostrarAlta(false)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardandoAlta} style={{ flex: 1 }}>
                {guardandoAlta ? "Guardando…" : "Crear terminal"}
              </Boton>
            </div>
          </form>
        </div>
      )}

      {editando && (
        <div
          className="modal-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setEditando(null)}
        >
          <form
            className="modal-panel"
            onSubmit={enviarEdicion}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 380, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Editar terminal</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              <strong>{editando.username}</strong> · {editando.tipo}
            </p>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Ubicación
              <input
                type="text"
                required
                value={formularioEdicion.ubicacion ?? ""}
                onChange={(e) => setFormularioEdicion((f) => ({ ...f, ubicacion: e.target.value }))}
                style={estilosCampo}
              />
            </label>

            {editando.tipo === "adms" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Número de serie
                <input
                  type="text"
                  value={formularioEdicion.numeroSerie ?? ""}
                  onChange={(e) => setFormularioEdicion((f) => ({ ...f, numeroSerie: e.target.value }))}
                  style={estilosCampo}
                />
              </label>
            )}

            {errorEdicion && (
              <div style={{ fontSize: 13, color: "var(--err)", background: "color-mix(in srgb, var(--err) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--err) 25%, transparent)", borderRadius: 8, padding: "10px 12px" }}>
                {errorEdicion}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Boton variante="outline" type="button" onClick={() => setEditando(null)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardandoEdicion} style={{ flex: 1 }}>
                {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
              </Boton>
            </div>
          </form>
        </div>
      )}

      {confirmandoActivo && (
        <ModalConfirmacion
          titulo={confirmandoActivo.activo ? "Desactivar terminal" : "Activar terminal"}
          mensaje={
            confirmandoActivo.activo ? (
              <>
                <strong>{confirmandoActivo.username}</strong> dejará de poder registrar marcaciones hasta que se active de nuevo.
              </>
            ) : (
              <>
                <strong>{confirmandoActivo.username}</strong> podrá volver a registrar marcaciones normalmente.
              </>
            )
          }
          etiquetaConfirmar={confirmandoActivo.activo ? "Desactivar" : "Activar"}
          peligroso={confirmandoActivo.activo}
          onCancelar={() => setConfirmandoActivo(null)}
          onConfirmar={async () => {
            await alternarActivo(confirmandoActivo);
            setConfirmandoActivo(null);
          }}
        />
      )}
    </div>
  );
}

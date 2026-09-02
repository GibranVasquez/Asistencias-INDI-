import { Fragment, FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import {
  crearTerminal,
  DatosAltaTerminal,
  DatosEdicionTerminal,
  editarTerminal,
  listarTerminales,
  Terminal,
  sincronizarMarcaciones,
} from "@/features/terminales/api";
import { ResultadoSincronizacionModal } from "@/features/terminales/ResultadoSincronizacionModal";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import EstadoVacio from "@/shared/components/EstadoVacio";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import ResumenModulo from "@/shared/components/ResumenModulo";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";
import { listarObras, ObraResumen } from "@/core/api/resources/obras";

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
  return { username: "", password: "", tipo: "adms", ubicacion: "", numeroSerie: "", obraId: "" };
}

export default function TerminalesPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [terminales, setTerminales] = useState<Terminal[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obras, setObras] = useState<ObraResumen[]>([]);

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
  const [configLocal, setConfigLocal] = useState<{ terminal: Terminal; host: string; puerto: number; guardando: boolean; estado: string | null }>({ terminal: null as unknown as Terminal, host: "", puerto: 4370, guardando: false, estado: null });
  const [resultadoSync, setResultadoSync] = useState<{ terminal: Terminal; resultado?: Awaited<ReturnType<typeof sincronizarMarcaciones>>; error?: string } | null>(null);
  const [detecciones, setDetecciones] = useState<Record<string, { serial: string; host: string; puerto: number; model?: string | null }>>({});
  const [buscando, setBuscando] = useState(false);

  const bridgeTerminales = window.indiApp?.terminales;

  const buscarTerminales = useCallback(async () => {
    if (!bridgeTerminales || !terminales?.length) return;
    setBuscando(true);
    try {
      const encontrados = await bridgeTerminales.descubrir(terminales) as { terminalId: string | null; serial: string; host: string; puerto: number; model?: string | null }[];
      const porId: Record<string, { serial: string; host: string; puerto: number; model?: string | null }> = {};
      for (const encontrado of encontrados) if (encontrado.terminalId) { porId[encontrado.terminalId] = encontrado; await bridgeTerminales.guardarConfig({ terminalId: encontrado.terminalId, numeroSerieEsperado: encontrado.serial, adapterKey: "zkteco-s922", host: encontrado.host, puerto: encontrado.puerto }); }
      setDetecciones(porId);
    } finally { setBuscando(false); }
  }, [bridgeTerminales, terminales]);

  async function abrirConexion(t: Terminal) {
    const guardada = bridgeTerminales ? await bridgeTerminales.leerConfig(t.id) as { host?: string; puerto?: number } | null : null;
    setConfigLocal({ terminal: t, host: guardada?.host ?? "", puerto: guardada?.puerto ?? 4370, guardando: false, estado: null });
  }

  async function probarConexionLocal() {
    const t = configLocal.terminal; if (!t || !bridgeTerminales) return;
    setConfigLocal((c) => ({ ...c, guardando: true, estado: null }));
    try {
      const config = { terminalId: t.id, numeroSerieEsperado: t.numeroSerie, adapterKey: "zkteco-s922", host: configLocal.host, puerto: configLocal.puerto };
      await bridgeTerminales.guardarConfig(config); const info = await bridgeTerminales.probarConexion(config) as { serial: string; model?: string; firmware?: string };
      setConfigLocal((c) => ({ ...c, guardando: false, estado: `Conectado · SN ${info.serial}${info.model ? ` · ${info.model}` : ""}` }));
    } catch (e) { setConfigLocal((c) => ({ ...c, guardando: false, estado: e instanceof Error ? e.message : "No se pudo conectar." })); }
  }

  async function sincronizarLocal() {
    const t = configLocal.terminal; if (!t || !bridgeTerminales) return;
    setConfigLocal((c) => ({ ...c, guardando: true, estado: null }));
    try {
      const config = { terminalId: t.id, numeroSerieEsperado: t.numeroSerie, adapterKey: "zkteco-s922", host: configLocal.host, puerto: configLocal.puerto };
      await bridgeTerminales.guardarConfig(config); const lectura = await bridgeTerminales.descargarMarcaciones(config) as { marcaciones: unknown[]; info: unknown };
      const resultado = await sincronizarMarcaciones(token, t.id, lectura.marcaciones);
      setResultadoSync({ terminal: t, resultado }); setConfigLocal((c) => ({ ...c, guardando: false, estado: "Sincronización completada" })); cargar();
    } catch (e) { setConfigLocal((c) => ({ ...c, guardando: false, estado: null })); setResultadoSync({ terminal: t, error: e instanceof ApiError ? e.message : "No se pudo sincronizar el terminal." }); }
  }

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
  useEffect(() => { if (terminales) void buscarTerminales(); }, [terminales, buscarTerminales]);
  useEffect(() => { listarObras(token).then((r) => setObras(r.obras)).catch(() => setObras([])); }, [token]);

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
        obraId: formularioAlta.tipo === "adms" ? (formularioAlta.obraId || null) : null,
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
      <EncabezadoPagina titulo="Terminales" descripcion="Administra dispositivos autorizados para la operación de asistencia." metadata="Gestión de dispositivos" accion={<Boton
          onClick={() => {
            setFormularioAlta(formularioAltaVacio());
            setErrorAlta(null);
            setMostrarAlta(true);
          }}
        >
          + Nuevo terminal
        </Boton>} />

      {terminales && (
        <ResumenModulo
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
        <EncabezadoSeccion titulo="Dispositivos autorizados" descripcion="Vinculación, ubicación y estado de las terminales registradas." accion={<Boton type="button" variante="outline" tamano="pequeno" onClick={() => void buscarTerminales()} disabled={buscando}>{buscando ? "Buscando…" : "Buscar terminales"}</Boton>} />
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando terminales…</div>
        ) : terminales?.length === 0 ? (
          <EstadoVacio titulo="No hay terminales registradas" descripcion="Las terminales dadas de alta aparecerán aquí con su estado de conexión." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Alias</th>
                  <th style={{ padding: "10px 12px" }}>Tipo</th>
                  <th style={{ padding: "10px 12px" }}>Serial / SN</th>
                  <th style={{ padding: "10px 12px" }}>Obra</th>
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
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.numeroSerie ?? "No configurado"}</td>
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.obraNombre ?? t.obraId ?? "No configurada"}</td>
                        <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.ubicacion}</td>
                        <td style={{ padding: "11px 12px", color: detecciones[t.id] ? "var(--ok)" : "var(--muted)" }}>{detecciones[t.id] ? `Conectado · SN ${detecciones[t.id].serial} · ${detecciones[t.id].host}:${detecciones[t.id].puerto}` : t.estadoConexion}</td>
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
                              setFormularioEdicion({ ubicacion: t.ubicacion, numeroSerie: t.numeroSerie, obraId: t.obraId });
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
                          {t.tipo === "adms" && <Boton variante="outline" tamano="pequeno" onClick={() => void abrirConexion(t)}>Sincronizar</Boton>}
                        </td>
                      </tr>
                      {erroresFila[t.id] && (
                        <tr>
                          <td colSpan={9} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>
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
              Alias del dispositivo
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
              <select required value={formularioAlta.tipo} onChange={(e) => setFormularioAlta((f) => ({ ...f, tipo: e.target.value }))} style={estilosCampo}>
                <option value="adms">ADMS</option>
                <option value="kiosco">Kiosco</option>
              </select>
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
                required
                value={formularioAlta.numeroSerie ?? ""}
                  onChange={(e) => setFormularioAlta((f) => ({ ...f, numeroSerie: e.target.value }))}
                  style={estilosCampo}
                />
              </label>
            )}

            {formularioAlta.tipo === "adms" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Obra
                <select required value={formularioAlta.obraId ?? ""} onChange={(e) => setFormularioAlta((f) => ({ ...f, obraId: e.target.value }))} style={estilosCampo}>
                  <option value="">Selecciona una obra</option>
                  {obras.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
                </select>
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
      {configLocal.terminal?.id && (
        <div className="modal-backdrop" onClick={() => setConfigLocal((c) => ({ ...c, terminal: null as unknown as Terminal }))}>
          <div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 420, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Sincronizar terminal</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Se descargarán las marcaciones almacenadas. No se eliminará información del dispositivo.</p>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>Host / IP<input value={configLocal.host} onChange={(e) => setConfigLocal((c) => ({ ...c, host: e.target.value }))} placeholder="IP local del terminal" /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>Puerto<input type="number" min={1} max={65535} value={configLocal.puerto} onChange={(e) => setConfigLocal((c) => ({ ...c, puerto: Number(e.target.value) }))} /></label>
            {configLocal.estado && <div style={{ color: configLocal.estado.startsWith("Conectado") || configLocal.estado === "Sincronización completada" ? "var(--ok)" : "var(--err)", fontSize: 13 }}>{configLocal.estado}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Boton type="button" variante="outline" onClick={() => void probarConexionLocal()} disabled={configLocal.guardando}>Probar conexión</Boton><Boton type="button" onClick={() => void sincronizarLocal()} disabled={configLocal.guardando || !configLocal.host}>Sincronizar marcaciones</Boton><Boton type="button" variante="outline" onClick={() => setConfigLocal((c) => ({ ...c, terminal: null as unknown as Terminal }))}>Cerrar</Boton></div>
          </div>
        </div>
      )}
      {resultadoSync && (
        resultadoSync.error ? <div className="modal-backdrop" onClick={() => setResultadoSync(null)}><div className="modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}><p style={{ color: "var(--err)" }}>{resultadoSync.error}</p><Boton type="button" onClick={() => setResultadoSync(null)}>Cerrar</Boton></div></div> : resultadoSync.resultado ? <ResultadoSincronizacionModal resultado={resultadoSync.resultado} onCerrar={() => setResultadoSync(null)} /> : null
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

            {editando.tipo === "adms" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Obra
                <select required value={formularioEdicion.obraId ?? ""} onChange={(e) => setFormularioEdicion((f) => ({ ...f, obraId: e.target.value }))} style={estilosCampo}>
                  <option value="">Selecciona una obra</option>
                  {obras.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
                </select>
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

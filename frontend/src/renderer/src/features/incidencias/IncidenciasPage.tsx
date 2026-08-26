import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import { listarSecciones, Seccion } from "@/core/api/resources/secciones";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import { buscarCandidatoReconciliacion, CandidatoReconciliacion, Incidencia, listarIncidencias, reconciliarIncidencia } from "@/features/incidencias/api";
import { evaluarElegibilidad } from "@/features/incidencias/elegibilidad";
import { fechaEventoVisible } from "@/features/incidencias/tiempoCivil";
import Boton from "@/shared/components/Boton";
import EstadoVacio from "@/shared/components/EstadoVacio";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";
import ResumenModulo from "@/shared/components/ResumenModulo";

function mensajeError(error: unknown): string {
  if (!(error instanceof ApiError)) return "No se pudo completar la reconciliación.";
  if (error.status === 403) return "No tienes permisos para reconciliar esta incidencia.";
  if (error.status === 404) return "El evento, trabajador o Frente ya no está disponible.";
  if (error.message.includes("no está activo")) return "El trabajador ya no está activo.";
  if (error.message.includes("no coincide")) return "El número de checador ya no coincide con el PIN reportado.";
  if (error.message.includes("no pertenece")) return "El Frente seleccionado no pertenece a la Obra de origen.";
  if (error.message.includes("Obra de origen")) return "La incidencia no tiene una Obra de origen registrada.";
  if (error.message.includes("fecha y hora civiles")) return "Esta incidencia no contiene fecha/hora civil confiable y requiere revisión especial.";
  if (error.status === 409) return "La incidencia ya fue reconciliada con otra asistencia.";
  return "No se pudo completar la reconciliación.";
}

export default function IncidenciasPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null);
  const [candidato, setCandidato] = useState<CandidatoReconciliacion | null>(null);
  const [frentes, setFrentes] = useState<Seccion[]>([]);
  const [frenteId, setFrenteId] = useState("");
  const [trabajadorConfirmado, setTrabajadorConfirmado] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [mensajeModal, setMensajeModal] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await listarIncidencias(token, { busqueda: consulta, pagina, limite: 25 });
      setIncidencias(respuesta.items); setTotal(respuesta.total); setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo consultar el centro de incidencias.");
    } finally { setCargando(false); }
  }, [token, consulta, pagina]);

  // La carga sincroniza estado con el recurso remoto al cambiar filtros.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    if (!seleccionada) return;
    const elegibilidad = evaluarElegibilidad(seleccionada);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCandidato(null); setFrentes([]); setFrenteId(""); setTrabajadorConfirmado(false); setErrorModal(null);
    if (!elegibilidad.elegible) return;
    let cancelado = false;
    setCargandoDetalle(true);
    Promise.all([
      buscarCandidatoReconciliacion(token, seleccionada.identificadorDispositivo),
      listarSecciones(token, seleccionada.obraId as string),
    ]).then(([respuestaCandidato, respuestaFrentes]) => {
      if (cancelado) return;
      setCandidato(respuestaCandidato.candidato); setFrentes(respuestaFrentes.secciones);
    }).catch((e) => { if (!cancelado) setErrorModal(mensajeError(e)); }).finally(() => { if (!cancelado) setCargandoDetalle(false); });
    return () => { cancelado = true; };
  }, [seleccionada, token]);

  function buscar(e: FormEvent) { e.preventDefault(); setPagina(1); setConsulta(busqueda.trim()); }
  function abrir(incidencia: Incidencia) { setMensajeModal(null); setErrorModal(null); setSeleccionada(incidencia); }
  function cerrar() { if (!enviando) setSeleccionada(null); }

  async function reconciliar() {
    if (!seleccionada || !candidato || !trabajadorConfirmado || !frenteId || enviando) return;
    setEnviando(true); setErrorModal(null);
    try {
      const respuesta = await reconciliarIncidencia(token, seleccionada.id, candidato.id, frenteId);
      const actualizada: Incidencia = { ...seleccionada, estado: "reconciliada", asistenciaId: respuesta.evento.asistenciaId, reconciliadoEn: respuesta.evento.reconciliadoEn };
      setIncidencias((actuales) => actuales.map((i) => i.id === actualizada.id ? actualizada : i)); setSeleccionada(actualizada);
      setMensajeModal(respuesta.resultado === "reconciliado" ? "Asistencia registrada correctamente." : respuesta.resultado === "ya_existia" ? "La asistencia ya existía y la incidencia quedó vinculada correctamente." : "Esta incidencia ya había sido reconciliada.");
    } catch (e) {
      setErrorModal(mensajeError(e));
      if (e instanceof ApiError && (e.status === 409 || e.message.includes("ya fue reconciliado"))) await cargar();
    } finally { setEnviando(false); }
  }

  const elegibilidad = seleccionada ? evaluarElegibilidad(seleccionada) : null;
  const puedeEnviar = Boolean(elegibilidad?.elegible && candidato && trabajadorConfirmado && frenteId && !enviando);

  return <div style={{ padding: "26px 30px 36px" }}>
    <EncabezadoPagina titulo="Centro de incidencias" descripcion="Revisa eventos que requieren atención o conciliación." metadata="Supervisión operativa" />
    <ResumenModulo etiqueta="Eventos de incidencias" icono="!" items={[{ etiqueta: "Eventos", valor: total }, { etiqueta: "ADMS", valor: total }]} />
    <div className="tarjeta-admin" style={{ marginTop: 16, overflow: "hidden" }}>
      <EncabezadoSeccion titulo="Bandeja de revisión" descripcion="Eventos cuyo identificador requiere confirmación operativa." />
      <form onSubmit={buscar} className="filters-bar" style={{ padding: "0 20px 16px" }}><input aria-label="Buscar incidencias" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar PIN, terminal o ubicación" /><Boton tamano="pequeno" type="submit">Buscar</Boton>{consulta && <Boton tamano="pequeno" variante="outline" type="button" onClick={() => { setBusqueda(""); setConsulta(""); setPagina(1); }}>Limpiar</Boton>}</form>
      {error ? <div role="alert" className="module-message error">{error}</div> : cargando ? <div className="module-message">Cargando incidencias…</div> : incidencias.length === 0 ? <EstadoVacio titulo="No hay incidencias" descripcion="Los eventos que requieren revisión aparecerán aquí." /> : <div className="table-scroll"><table className="tabla-premium"><thead><tr><th>Fecha del evento</th><th>Tipo</th><th>Identificador</th><th>Terminal</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{incidencias.map((incidencia) => { const fila = evaluarElegibilidad(incidencia); const reconciliada = incidencia.estado === "reconciliada" || incidencia.asistenciaId !== null; return <tr key={incidencia.id}><td>{fechaEventoVisible(incidencia)}</td><td>ADMS no reconciliado</td><td className="numeric-cell">{incidencia.identificadorDispositivo}</td><td>{incidencia.terminal}<small>{incidencia.ubicacion}</small></td><td><span className={`status-chip ${reconciliada ? "success" : "warning"}`}>{reconciliada ? "Reconciliada" : "Pendiente"}</span></td><td><Boton tamano="pequeno" variante="outline" onClick={() => abrir(incidencia)}>{reconciliada ? "Revisar" : fila.elegible ? "Reconciliar" : "Revisar"}</Boton></td></tr>; })}</tbody></table></div>}
      {total > 25 && <div className="pagination"><Boton tamano="pequeno" variante="outline" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Boton><span>Página {pagina}</span><Boton tamano="pequeno" variante="outline" disabled={pagina * 25 >= total} onClick={() => setPagina((p) => p + 1)}>Siguiente</Boton></div>}
    </div>
    {seleccionada && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={cerrar}><div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="titulo-reconciliacion" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") cerrar(); }} style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 520, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
      <h3 id="titulo-reconciliacion" style={{ marginTop: 0 }}>Reconciliar incidencia ADMS</h3>
      <dl><dt>PIN reportado</dt><dd>{seleccionada.identificadorDispositivo}</dd><dt>Obra</dt><dd>{seleccionada.obraNombre ?? "No registrada"}</dd><dt>Terminal</dt><dd>{seleccionada.terminal}{seleccionada.ubicacion ? ` · ${seleccionada.ubicacion}` : ""}</dd><dt>Fecha civil</dt><dd>{seleccionada.fechaMarcacion ? seleccionada.fechaMarcacion.split("-").reverse().join("/") : "No disponible"}</dd><dt>Hora civil</dt><dd>{seleccionada.horaMarcacion ?? "No disponible"}</dd></dl>
      {mensajeModal ? <div role="status" className="module-message success">{mensajeModal}</div> : !elegibilidad?.elegible ? <div role="alert" className="module-message error">{elegibilidad?.mensaje ?? "Esta incidencia no puede reconciliarse."}</div> : cargandoDetalle ? <div className="module-message">Buscando candidato y Frentes…</div> : <><h4>Trabajador</h4>{candidato ? <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={trabajadorConfirmado} onChange={(e) => setTrabajadorConfirmado(e.target.checked)} /> <span>Confirmo que <strong>{candidato.nombreCompleto}</strong> es el trabajador correcto (número de checador {candidato.numeroChecador}).</span></label> : <div role="alert" className="module-message">No se encontró un trabajador activo con este número de checador.</div>}<h4>Frente</h4><label htmlFor="frente-reconciliacion">Selecciona el Frente</label><select id="frente-reconciliacion" value={frenteId} onChange={(e) => setFrenteId(e.target.value)} disabled={!candidato || enviando}><option value="">Selecciona un Frente</option>{frentes.map((frente) => <option key={frente.id} value={frente.id}>{frente.nombre}</option>)}</select>{!frentes.length && <p className="module-message">No hay Frentes disponibles para la Obra de origen.</p>}<p className="module-message">Se registrará una asistencia con la fecha y hora reportadas por el dispositivo.</p>{errorModal && <div role="alert" className="module-message error">{errorModal}</div>}</>}
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}><Boton variante="outline" type="button" onClick={cerrar} disabled={enviando}>Cerrar</Boton><Boton type="button" onClick={reconciliar} disabled={!puedeEnviar} textoEnProceso="Reconciliando…">Reconciliar</Boton></div>
    </div></div>}
  </div>;
}

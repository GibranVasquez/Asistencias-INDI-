import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/core/api/client";
import { Incidencia, listarIncidencias } from "@/features/incidencias/api";
import Boton from "@/shared/components/Boton";
import EstadoVacio from "@/shared/components/EstadoVacio";
import ResumenModulo from "@/shared/components/ResumenModulo";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";

export default function IncidenciasPage() {
  const { sesion } = useAutenticacion(); const navigate = useNavigate(); const token = sesion!.token;
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]); const [total, setTotal] = useState(0); const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState(""); const [consulta, setConsulta] = useState(""); const [cargando, setCargando] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { listarIncidencias(token, { busqueda: consulta, pagina, limite: 25 }).then((r) => { setIncidencias(r.items); setTotal(r.total); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : "No se pudo consultar el centro de incidencias.")).finally(() => setCargando(false)); }, [token, consulta, pagina]);
  function buscar(e: FormEvent) { e.preventDefault(); setPagina(1); setConsulta(busqueda.trim()); }
  const destino = sesion!.usuario.rol === "rh" ? "/panel/trabajadores" : "/panel/terminales";
  return <div style={{ padding: "26px 30px 36px" }}>
    <EncabezadoPagina titulo="Centro de incidencias" descripcion="Revisa eventos que requieren atención o conciliación." metadata="Supervisión operativa" />
    <ResumenModulo etiqueta="Eventos pendientes" icono="!" items={[{ etiqueta: "Pendientes", valor: total, tono: total ? "warn" : "neutral" }, { etiqueta: "ADMS sin reconciliar", valor: total }]} />
    <div className="tarjeta-admin" style={{ marginTop: 16, overflow: "hidden" }}><EncabezadoSeccion titulo="Bandeja de revisión" descripcion="Eventos cuyo identificador no corresponde todavía a un trabajador." />
      <form onSubmit={buscar} className="filters-bar" style={{ padding: "0 20px 16px" }}><input aria-label="Buscar incidencias" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar PIN, terminal o ubicación" /><Boton tamano="pequeno" type="submit">Buscar</Boton>{consulta && <Boton tamano="pequeno" variante="outline" type="button" onClick={() => { setBusqueda(""); setConsulta(""); setPagina(1); }}>Limpiar</Boton>}</form>
      {error ? <div role="alert" className="module-message error">{error}</div> : cargando ? <div className="module-message">Cargando incidencias…</div> : incidencias.length === 0 ? <EstadoVacio titulo="No hay incidencias pendientes" descripcion="Los eventos que requieren revisión aparecerán aquí." /> : <div className="table-scroll"><table className="tabla-premium"><thead><tr><th>Fecha del evento</th><th>Tipo</th><th>Identificador</th><th>Terminal</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{incidencias.map((incidencia) => <tr key={incidencia.id}><td>{new Date(incidencia.fechaEvento).toLocaleString("es-MX")}</td><td>ADMS no reconciliado</td><td className="numeric-cell">{incidencia.identificadorDispositivo}</td><td>{incidencia.terminal}<small>{incidencia.ubicacion}</small></td><td><span className="status-chip warning">Pendiente</span></td><td><Boton tamano="pequeno" variante="outline" onClick={() => navigate(destino)}>Revisar</Boton></td></tr>)}</tbody></table></div>}
      {total > 25 && <div className="pagination"><Boton tamano="pequeno" variante="outline" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Boton><span>Página {pagina}</span><Boton tamano="pequeno" variante="outline" disabled={pagina * 25 >= total} onClick={() => setPagina((p) => p + 1)}>Siguiente</Boton></div>}
    </div>
  </div>;
}

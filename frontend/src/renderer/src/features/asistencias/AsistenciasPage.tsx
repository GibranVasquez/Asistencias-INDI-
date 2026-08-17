import { useEffect, useMemo, useState } from "react";
import { AsistenciaListada, listarAsistencias } from "@/features/asistencias/api";
import { ApiError } from "@/core/api/client";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import ChipEstado from "@/shared/components/ChipEstado";
import Boton from "@/shared/components/Boton";
import EstadoVacio from "@/shared/components/EstadoVacio";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import ResumenModulo from "@/shared/components/ResumenModulo";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";
import { agruparAsistenciasPorTrabajador, aISO, encabezadoDia, lunesDeSemana, sumarDias } from "@/features/asistencias/listaSemanal";

const ETIQUETA_METODO: Record<string, string> = { huella: "Huella", rostro: "Rostro" };

export default function AsistenciasPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [inicioSemana, setInicioSemana] = useState(() => lunesDeSemana(new Date()));
  const fechaDesde = aISO(inicioSemana);
  const fechaHasta = aISO(sumarDias(inicioSemana, 6));
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [busquedaTrabajador, setBusquedaTrabajador] = useState("");
  const [vista, setVista] = useState<"semanal" | "registros">("semanal");
  const [detalleDia, setDetalleDia] = useState<{ fila: ReturnType<typeof agruparAsistenciasPorTrabajador>[number]; dia: string } | null>(null);

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

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, indice) => aISO(sumarDias(inicioSemana, indice))),
    [inicioSemana]
  );

  const filasSemanales = useMemo(() => agruparAsistenciasPorTrabajador(asistenciasFiltradas), [asistenciasFiltradas]);

  function cambiarSemana(dias: number) {
    setInicioSemana((actual) => sumarDias(actual, dias));
  }

  function volverSemanaActual() {
    setInicioSemana(lunesDeSemana(new Date()));
  }

  const trabajadoresUnicos = useMemo(
    () => new Set(asistenciasFiltradas.map((a) => a.trabajadorNombre)).size,
    [asistenciasFiltradas]
  );
  const frentesVisibles = useMemo(
    () => new Set(asistenciasFiltradas.map((a) => a.seccionId)).size,
    [asistenciasFiltradas]
  );

  const periodoVisible = `${fechaDesde} — ${fechaHasta}`;

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <EncabezadoPagina
        titulo="Asistencia"
        descripcion="Lista semanal de asistencia: consulta las marcaciones del personal por semana y frente."
        metadata="Control operativo de obra"
      />

      {!cargando && asistencias && (
        <ResumenModulo
          etiqueta={`Semana · ${periodoVisible}`}
          icono="◷"
          items={[
            { etiqueta: "Marcaciones", valor: asistenciasFiltradas.length },
            { etiqueta: "Personal con registro", valor: trabajadoresUnicos },
            { etiqueta: "Frentes", valor: frentesVisibles },
          ]}
        />
      )}

      <div className="barra-filtros" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Boton type="button" variante="outline" tamano="pequeno" onClick={() => cambiarSemana(-7)}>Semana anterior</Boton>
          <Boton type="button" variante="outline" tamano="pequeno" onClick={volverSemanaActual}>Semana actual</Boton>
          <Boton type="button" variante="outline" tamano="pequeno" onClick={() => cambiarSemana(7)}>Semana siguiente</Boton>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Frente
          <select value={seccionFiltro} onChange={(e) => setSeccionFiltro(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, minWidth: 160, background: "var(--surface)", color: "var(--ink)" }}>
            <option value="">Todos los frentes</option>
            {seccionesDisponibles.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Buscar trabajador
          <input type="text" placeholder="Nombre…" value={busquedaTrabajador} onChange={(e) => setBusquedaTrabajador(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" }} />
        </label>
        <div role="group" aria-label="Vista de asistencia" style={{ display: "flex", gap: 6 }}>
          <Boton type="button" variante={vista === "semanal" ? "solido" : "outline"} tamano="pequeno" onClick={() => setVista("semanal")}>Lista semanal</Boton>
          <Boton type="button" variante={vista === "registros" ? "solido" : "outline"} tamano="pequeno" onClick={() => setVista("registros")}>Registros</Boton>
        </div>
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        <EncabezadoSeccion titulo={vista === "semanal" ? "Lista semanal de asistencia" : "Registros de asistencia"} descripcion={vista === "semanal" ? "Las horas se agrupan por trabajador y día. El sistema conserva las marcaciones originales." : "Consulta el detalle de cada marcación del periodo seleccionado."} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{cargando ? "Cargando asistencia…" : `${asistenciasFiltradas.length} marcación${asistenciasFiltradas.length === 1 ? "" : "es"} · ${fechaDesde} — ${fechaHasta}`}</span>
        </div>

        {error ? <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
          : cargando ? <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando lista semanal…</div>
          : asistenciasFiltradas.length === 0 ? <EstadoVacio titulo="No hay marcaciones en esta semana" descripcion="Prueba cambiando la semana, el frente o la búsqueda de trabajador." />
          : vista === "semanal" ? (
            <div className="table-scroll asistencia-semanal-scroll">
              <table className="tabla-premium asistencia-semanal">
                <thead><tr><th className="columna-fija">Trabajador</th><th>Frentes</th>{diasSemana.map((dia) => <th key={dia} className="dia-semana">{encabezadoDia(dia)}</th>)}</tr></thead>
                <tbody>{filasSemanales.map((fila) => <tr key={fila.trabajadorId}>
                  <td className="columna-fija"><strong>{fila.trabajadorNombre}</strong></td>
                  <td>{fila.frentes.join(", ")}</td>
                  {diasSemana.map((dia) => {
                    const registros = fila.porDia.get(dia) ?? [];
                    return <td key={dia} className="celda-dia" title={registros.length ? `${registros.length} marcación${registros.length === 1 ? "" : "es"}` : "Sin registro"}>
                      {registros.length ? <button type="button" className="celda-dia-boton" onClick={() => setDetalleDia({ fila, dia })} aria-label={`Ver marcaciones de ${fila.trabajadorNombre} del ${dia}`}>
                        {registros.map((registro) => <span key={registro.id}>{registro.hora.slice(11, 16)}</span>)}
                      </button> : <span className="sin-registro">—</span>}
                    </td>;
                  })}
                </tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll"><table className="tabla-premium"><thead><tr><th>Trabajador</th><th>Frente</th><th>Fecha</th><th>Hora</th><th>Turno</th><th>Método</th></tr></thead><tbody>{asistenciasFiltradas.map((a) => <tr key={a.id}><td><strong>{a.trabajadorNombre}</strong></td><td>{a.seccionNombre}</td><td>{a.fecha.slice(0, 10)}</td><td className="numeric-cell">{a.hora.slice(11, 16)}</td><td>{a.turno}</td><td><ChipEstado tamano={26} color="indi" icono={a.metodoUsado === "rostro" ? "🙂" : "👆"} titulo={ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado} /> {ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado}</td></tr>)}</tbody></table></div>
          )}
      </div>
      {detalleDia && (() => {
        const registros = detalleDia.fila.porDia.get(detalleDia.dia) ?? [];
        const turnos = [...new Set(registros.map((registro) => registro.turno))].join(", ");
        const metodos = [...new Set(registros.map((registro) => ETIQUETA_METODO[registro.metodoUsado] ?? registro.metodoUsado))].join(", ");
        return <div className="modal-backdrop" onClick={() => setDetalleDia(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Detalle de asistencia" onClick={(evento) => evento.stopPropagation()}>
            <EncabezadoSeccion titulo="Detalle de asistencia" descripcion={`${detalleDia.fila.trabajadorNombre} · ${detalleDia.dia}`} />
            <dl className="detalle-asistencia-lista">
              <dt>Trabajador</dt><dd>{detalleDia.fila.trabajadorNombre}</dd>
              <dt>Frentes</dt><dd>{detalleDia.fila.frentes.join(", ")}</dd>
              <dt>Marcaciones</dt><dd>{registros.map((registro) => registro.hora.slice(11, 16)).join(" · ")}</dd>
              <dt>Turno</dt><dd>{turnos}</dd>
              <dt>Método</dt><dd>{metodos}</dd>
            </dl>
            <Boton type="button" onClick={() => setDetalleDia(null)}>Cerrar</Boton>
          </div>
        </div>;
      })()}
    </div>
  );
}

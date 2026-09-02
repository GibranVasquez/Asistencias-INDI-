import { useEffect, useMemo, useState } from "react";
import { AsistenciaListada, exportarListaSemanal, listarAsistencias, ETIQUETA_TIPO_MARCACION } from "@/features/asistencias/api";
import { ApiError } from "@/core/api/client";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import ChipEstado from "@/shared/components/ChipEstado";
import Boton from "@/shared/components/Boton";
import EstadoVacio from "@/shared/components/EstadoVacio";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import ResumenModulo from "@/shared/components/ResumenModulo";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";
import { agruparAsistenciasPorTrabajador, aISO, encabezadoDia, lunesDeSemana, numeroSemana, periodoSemanalLegible, sumarDias, TIPOS_MARCACION_OPERATIVOS, rangoExportacion } from "@/features/asistencias/listaSemanal";
import MarcacionesDiaCell from "@/features/asistencias/MarcacionesDiaCell";
import { obtenerObraActual } from "@/core/api/resources/obras";

const ETIQUETA_METODO: Record<string, string> = { huella: "Huella", rostro: "Rostro" };

export default function AsistenciasPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [inicioSemana, setInicioSemana] = useState(() => lunesDeSemana(new Date()));
  const fechaDesde = aISO(inicioSemana);
  const fechaHasta = aISO(sumarDias(inicioSemana, 6));
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [busquedaTrabajador, setBusquedaTrabajador] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [vista, setVista] = useState<"semanal" | "registros">("semanal");
  const [modoExportacion, setModoExportacion] = useState<"semana" | "dia">("semana");
  const [fechaExportacion, setFechaExportacion] = useState(() => aISO(new Date()));
  const [detalleDia, setDetalleDia] = useState<{ fila: ReturnType<typeof agruparAsistenciasPorTrabajador>[number]; dia: string } | null>(null);

  const [asistencias, setAsistencias] = useState<AsistenciaListada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nombreObra, setNombreObra] = useState<string | null>(null);

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

  useEffect(() => {
    obtenerObraActual(token).then((respuesta) => setNombreObra(respuesta.obra.nombre)).catch(() => setNombreObra(null));
  }, [token]);

  // Las secciones del filtro salen de los datos ya cargados, no de un
  // catálogo aparte: recepcion puede leer /asistencias pero no /secciones,
  // así que un <select> poblado desde GET /secciones lo dejaría sin poder
  // filtrar por sección en absoluto.
  const seccionesDisponibles = useMemo(() => {
    const mapa = new Map<string, string>();
    asistencias?.forEach((a) => { if (a.seccionId) mapa.set(a.seccionId, a.seccionNombre); });
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [asistencias]);

  const asistenciasFiltradas = useMemo(() => {
    if (!asistencias) return [];
    const busqueda = busquedaTrabajador.trim().toLowerCase();
    return asistencias.filter((a) => {
      if (seccionFiltro && a.seccionId !== seccionFiltro) return false;
      if (busqueda && !a.trabajadorNombre.toLowerCase().includes(busqueda)) return false;
      if (turnoFiltro && a.turno !== turnoFiltro) return false;
      if (categoriaFiltro && a.trabajadorCategoria !== categoriaFiltro) return false;
      return true;
    });
  }, [asistencias, seccionFiltro, busquedaTrabajador, turnoFiltro, categoriaFiltro]);

  const turnosDisponibles = useMemo(() => [...new Set((asistencias ?? []).map((a) => a.turno))].sort(), [asistencias]);
  const categoriasDisponibles = useMemo(() => [...new Set((asistencias ?? []).map((a) => a.trabajadorCategoria))].filter(Boolean).sort(), [asistencias]);
  const trabajadorFiltroId = useMemo(() => {
    const busqueda = busquedaTrabajador.trim().toLowerCase();
    if (!busqueda) return undefined;
    const coincidencias = [...new Map((asistencias ?? []).filter((a) => a.trabajadorNombre.toLowerCase().includes(busqueda)).map((a) => [a.trabajadorId, a])).values()];
    return coincidencias.length === 1 ? coincidencias[0].trabajadorId : undefined;
  }, [asistencias, busquedaTrabajador]);
  const seccionSeleccionada = asistencias?.find((a) => a.seccionId === seccionFiltro);
  const areaVisible = seccionSeleccionada?.obraNombre || nombreObra || "No especificada";
  const responsablesVisibles = seccionSeleccionada?.seccionResponsables.map((r) => r.nombreCompleto).join(", ") || "No asignado";
  const periodoLegible = periodoSemanalLegible(fechaDesde, fechaHasta);

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

  async function exportar(formato: "pdf" | "excel") {
    try {
      const extension = formato === "pdf" ? "pdf" : "xlsx";
      const { fechaInicio: desde, fechaFin: hasta } = rangoExportacion(modoExportacion, fechaExportacion, fechaDesde, fechaHasta);
      await exportarListaSemanal(token, { fechaInicio: desde, fechaFin: hasta, seccionId: seccionFiltro || undefined, trabajadorId: trabajadorFiltroId, turno: turnoFiltro || undefined, categoria: categoriaFiltro || undefined, formato }, `Lista_Asistencia_${desde}_${hasta}.${extension}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar la lista semanal.");
    }
  }

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <EncabezadoPagina
        titulo="Asistencia"
        descripcion="Lista semanal de asistencia: consulta las marcaciones del personal por semana y frente."
        metadata="Control operativo de obra"
      />

      <section className="tarjeta-admin contexto-lista-semanal" style={{ marginTop: 16, padding: "18px 20px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14 }} aria-label="Contexto operativo de la lista semanal">
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "var(--accent)", textTransform: "uppercase" }}>Lista semanal de asistencia</div>
        <h2 style={{ margin: "5px 0 14px", fontSize: 18, color: "var(--ink)" }}>{areaVisible}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px 22px", fontSize: 13 }}>
          <div><span className="texto-kicker">Frente</span><strong>{seccionSeleccionada?.seccionNombre ?? "Todos los frentes"}</strong></div>
          <div><span className="texto-kicker">Tramo o ubicación</span><strong>{seccionSeleccionada?.seccionTramoUbicacion || "No especificado"}</strong></div>
          <div><span className="texto-kicker">Encargados de Frente</span><strong>{responsablesVisibles}</strong></div>
          <div><span className="texto-kicker">Turno</span><strong>{turnoFiltro || (new Set(asistenciasFiltradas.map((a) => a.turno)).size > 1 ? "Múltiple" : asistenciasFiltradas[0]?.turno || "No especificado")}</strong></div>
          <div><span className="texto-kicker">Categoría</span><strong>{categoriaFiltro || (new Set(asistenciasFiltradas.map((a) => a.trabajadorCategoria)).size > 1 ? "Todas las categorías" : asistenciasFiltradas[0]?.trabajadorCategoria || "No especificada")}</strong></div>
          <div><span className="texto-kicker">Semana</span><strong>{numeroSemana(inicioSemana)}</strong></div>
          <div><span className="texto-kicker">Periodo</span><strong>{periodoLegible}</strong></div>
        </div>
      </section>

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
        {turnosDisponibles.length > 0 && <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Turno<select value={turnoFiltro} onChange={(e) => setTurnoFiltro(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}><option value="">Todos los turnos</option>{turnosDisponibles.map((turno) => <option key={turno}>{turno}</option>)}</select></label>}
        {categoriasDisponibles.length > 0 && <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Categoría<select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}><option value="">Todas las categorías</option>{categoriasDisponibles.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></label>}
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Periodo de exportación<select value={modoExportacion} onChange={(e) => setModoExportacion(e.target.value as "semana" | "dia")} style={{ padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}><option value="semana">Semana seleccionada</option><option value="dia">Día específico</option></select></label>
        {modoExportacion === "dia" && <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>Fecha<input type="date" value={fechaExportacion} onChange={(e) => setFechaExportacion(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }} /></label>}
        <div style={{ display: "flex", gap: 6 }}><Boton type="button" variante="outline" tamano="pequeno" onClick={() => exportar("pdf")} textoEnProceso="Generando…">Exportar PDF</Boton><Boton type="button" variante="outline" tamano="pequeno" onClick={() => exportar("excel")} textoEnProceso="Generando…">Exportar Excel</Boton></div>
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
                <thead><tr><th className="columna-fija">ID</th><th className="columna-fija">Trabajador</th><th className="columna-fija">Puesto / categoría</th>{diasSemana.map((dia) => <th key={dia} className="dia-semana">{encabezadoDia(dia)}</th>)}</tr></thead>
                <tbody>{filasSemanales.map((fila, indiceFila) => <tr key={fila.trabajadorId}>
                  <td className="columna-fija"><strong>{String(indiceFila + 1).padStart(3, "0")}</strong></td>
                  <td className="columna-fija"><strong>{fila.trabajadorNombre}</strong><small>{fila.frentes.join(", ")}</small></td>
                  <td className="columna-fija">{fila.trabajadorCategoria || "No especificada"}</td>
                  {diasSemana.map((dia) => {
                    const marcas = fila.marcasPorDia.get(dia);
                    return <MarcacionesDiaCell key={dia} fecha={encabezadoDia(dia)} marcas={marcas} sinClasificar={fila.sinClasificarPorDia.get(dia)?.length ?? 0} onVerSinClasificar={() => setDetalleDia({ fila, dia })} />;
                  })}
                </tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll"><table className="tabla-premium"><thead><tr><th>Trabajador</th><th>Frente</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Turno</th><th>Método</th></tr></thead><tbody>{asistenciasFiltradas.map((a) => <tr key={a.id}><td><strong>{a.trabajadorNombre}</strong></td><td>{a.seccionNombre}</td><td>{a.fecha.slice(0, 10)}</td><td className="numeric-cell">{a.hora.slice(11, 16)}</td><td>{a.tipoMarcacion ? ETIQUETA_TIPO_MARCACION[a.tipoMarcacion] : "Sin clasificar"}</td><td>{a.turno}</td><td><ChipEstado tamano={26} color="indi" icono={a.metodoUsado === "rostro" ? "🙂" : "👆"} titulo={ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado} /> {ETIQUETA_METODO[a.metodoUsado] ?? a.metodoUsado}</td></tr>)}</tbody></table></div>
          )}
      </div>
      {detalleDia && (() => {
        const registros = detalleDia.fila.porDia.get(detalleDia.dia) ?? [];
        const turnos = [...new Set(registros.map((registro) => registro.turno))].join(", ");
        const metodos = [...new Set(registros.map((registro) => ETIQUETA_METODO[registro.metodoUsado] ?? registro.metodoUsado))].join(", ");
        const marcasPorTipo = new Map(TIPOS_MARCACION_OPERATIVOS.map((tipo) => [tipo, registros.filter((registro) => registro.tipoMarcacion === tipo).map((registro) => registro.hora.slice(11, 16))]));
        const sinClasificar = registros.filter((registro) => registro.tipoMarcacion === null);
        return <div className="modal-backdrop" onClick={() => setDetalleDia(null)}>
          <div className="modal-panel detalle-asistencia-modal" role="dialog" aria-modal="true" aria-label="Detalle de asistencia" onClick={(evento) => evento.stopPropagation()}>
            <EncabezadoSeccion titulo="Detalle de asistencia" descripcion="Información de la jornada seleccionada" />
            <dl className="detalle-asistencia-lista">
              <dt>Trabajador</dt><dd><strong>{detalleDia.fila.trabajadorNombre}</strong></dd>
              <dt>Fecha</dt><dd>{detalleDia.dia}</dd>
              <dt>Frente</dt><dd>{detalleDia.fila.frentes.join(", ") || "Sin asignación"}</dd>
              <dt>Turno</dt><dd>{turnos || "No especificado"}</dd>
              <dt>Método</dt><dd>{metodos || "No especificado"}</dd>
            </dl>
            <h4 className="detalle-asistencia-subtitulo">Marcaciones del día</h4>
            <div className="detalle-marcaciones-operativas">
              {TIPOS_MARCACION_OPERATIVOS.map((tipo) => {
                const horas = marcasPorTipo.get(tipo) ?? [];
                return horas.length ? <div key={tipo}><span>{ETIQUETA_TIPO_MARCACION[tipo]}</span><strong>{horas.join(" · ")}</strong></div> : null;
              })}
              {!TIPOS_MARCACION_OPERATIVOS.some((tipo) => (marcasPorTipo.get(tipo) ?? []).length) && <p>Sin marcaciones operativas</p>}
            </div>
            {sinClasificar.length > 0 && <div className="detalle-sin-clasificar"><span>Sin clasificar</span><strong>{sinClasificar.map((registro) => registro.hora.slice(11, 16)).join(" · ")}</strong></div>}
            <Boton type="button" onClick={() => setDetalleDia(null)}>Cerrar</Boton>
          </div>
        </div>;
      })()}
    </div>
  );
}

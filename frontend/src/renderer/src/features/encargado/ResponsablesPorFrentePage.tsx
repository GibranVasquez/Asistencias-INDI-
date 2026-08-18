import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/core/api/client";
import {
  asignarResponsableTramo,
  listarSecciones,
  listarTrabajadoresResponsables,
  retirarResponsableTramo,
  ResponsableTramo,
  Seccion,
} from "@/core/api/resources/secciones";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import EstadoVacio from "@/shared/components/EstadoVacio";

export default function ResponsablesPorFrentePage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [elegibles, setElegibles] = useState<ResponsableTramo[]>([]);
  const [seccionId, setSeccionId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [operando, setOperando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resultadoSecciones, resultadoElegibles] = await Promise.all([
        listarSecciones(token),
        listarTrabajadoresResponsables(token),
      ]);
      setSecciones(resultadoSecciones.secciones);
      setElegibles(resultadoElegibles.trabajadores);
      setSeccionId((actual) => actual && resultadoSecciones.secciones.some((s) => s.id === actual) ? actual : resultadoSecciones.secciones[0]?.id ?? "");
    } catch (err) {
      setSecciones([]);
      setError(err instanceof ApiError ? err.message : "No fue posible cargar los responsables.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  // La carga inicial sincroniza esta vista con los catálogos protegidos por sesión.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargar(); }, [cargar]);

  const seccion = secciones?.find((item) => item.id === seccionId) ?? null;
  const responsables = useMemo(() => seccion?.responsablesTramo ?? [], [seccion]);
  const idsAsignados = useMemo(() => new Set(responsables.map((item) => item.id)), [responsables]);
  const elegiblesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase();
    return elegibles.filter((trabajador) => !termino || `${trabajador.nombreCompleto} ${trabajador.categoria}`.toLocaleLowerCase().includes(termino));
  }, [busqueda, elegibles]);

  async function asignar(trabajadorId: string) {
    if (!seccionId) return;
    setOperando(trabajadorId);
    setMensaje(null);
    setError(null);
    try {
      const resultado = await asignarResponsableTramo(token, seccionId, trabajadorId);
      setSecciones((actuales) => actuales?.map((item) => item.id === seccionId ? { ...item, responsablesTramo: [...(item.responsablesTramo ?? []), resultado.responsable].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)) } : item) ?? actuales);
      setMensaje("Responsable asignado correctamente.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible asignar al responsable.");
    } finally {
      setOperando(null);
    }
  }

  async function retirar(trabajadorId: string) {
    if (!seccionId) return;
    setOperando(trabajadorId);
    setMensaje(null);
    setError(null);
    try {
      await retirarResponsableTramo(token, seccionId, trabajadorId);
      setSecciones((actuales) => actuales?.map((item) => item.id === seccionId ? { ...item, responsablesTramo: (item.responsablesTramo ?? []).filter((responsable) => responsable.id !== trabajadorId) } : item) ?? actuales);
      setMensaje("Responsable retirado correctamente.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible retirar al responsable.");
    } finally {
      setOperando(null);
    }
  }

  if (cargando) return <div style={{ padding: "26px 30px" }}><EncabezadoPagina titulo="Responsables por frente" descripcion="Asigna trabajadores responsables a cada frente y tramo de la obra." /><p role="status" style={{ color: "var(--muted)" }}>Cargando frentes...</p></div>;
  if (error && !secciones?.length) return <div style={{ padding: "26px 30px" }}><EncabezadoPagina titulo="Responsables por frente" descripcion="Asigna trabajadores responsables a cada frente y tramo de la obra." /><EstadoVacio titulo="No fue posible cargar los responsables" descripcion={error} accion={<Boton tamano="pequeno" onClick={() => void cargar()}>Reintentar</Boton>} /></div>;
  if (!secciones?.length) return <div style={{ padding: "26px 30px" }}><EncabezadoPagina titulo="Responsables por frente" descripcion="Asigna trabajadores responsables a cada frente y tramo de la obra." /><EstadoVacio titulo="No hay frentes configurados" descripcion="Configura un frente antes de asignar responsables del tramo." /></div>;

  return (
    <div style={{ padding: "26px 30px 36px", maxWidth: 1100 }}>
      <EncabezadoPagina titulo="Responsables por frente" descripcion="Asigna trabajadores responsables a cada frente y tramo de la obra." metadata="Gestión operativa" />
      <section className="tarjeta-admin" style={{ marginTop: 18, padding: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14 }} aria-label="Administración de responsables">
        <label style={{ display: "grid", gap: 7, maxWidth: 520, color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
          Frente
          <select value={seccionId} onChange={(event) => { setSeccionId(event.target.value); setMensaje(null); setError(null); }} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", font: "inherit" }}>
            {secciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 20 }}>
          <div>
            <span className="texto-kicker">Tramo o ubicación de la obra</span>
            <p style={{ margin: "7px 0 0", color: "var(--ink)", fontWeight: 700 }}>{seccion?.tramoUbicacion || "No especificado"}</p>
          </div>
          <div>
            <span className="texto-kicker">Responsables actuales</span>
            {responsables.length === 0 ? <p style={{ margin: "7px 0 0", color: "var(--muted)" }}>No hay responsables asignados a este frente.</p> : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{responsables.map((responsable) => <div key={responsable.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 9 }}><div><strong style={{ display: "block", color: "var(--ink)" }}>{responsable.nombreCompleto}</strong><span style={{ color: "var(--muted)", fontSize: 12.5 }}>{responsable.categoria}</span></div><Boton variante="outline" tamano="pequeno" disabled={operando !== null} onClick={() => retirar(responsable.id)} textoEnProceso="Retirando…">Quitar</Boton></div>)}</div>}
          </div>
        </div>
      </section>
      <section className="tarjeta-admin" style={{ marginTop: 18, padding: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14 }} aria-label="Asignar responsable">
        <h2 style={{ margin: 0, color: "var(--ink)", fontSize: 17 }}>Asignar responsable</h2>
        <p style={{ margin: "6px 0 14px", color: "var(--muted)", fontSize: 13.5 }}>Selecciona un trabajador activo para este frente.</p>
        <input aria-label="Buscar trabajador activo" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por nombre o categoría..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", font: "inherit" }} />
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {elegiblesFiltrados.filter((trabajador) => !idsAsignados.has(trabajador.id)).slice(0, 12).map((trabajador) => <div key={trabajador.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 9 }}><div><strong style={{ display: "block", color: "var(--ink)" }}>{trabajador.nombreCompleto}</strong><span style={{ color: "var(--muted)", fontSize: 12.5 }}>{trabajador.categoria} · Activo</span></div><Boton tamano="pequeno" disabled={operando !== null} onClick={() => asignar(trabajador.id)} textoEnProceso="Asignando…">Asignar</Boton></div>)}
          {elegiblesFiltrados.filter((trabajador) => !idsAsignados.has(trabajador.id)).length === 0 && <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No hay trabajadores activos disponibles para asignar.</p>}
        </div>
      </section>
      {(mensaje || error) && <p role="status" style={{ color: error ? "var(--err)" : "var(--ok)", marginTop: 14 }}>{error ?? mensaje}</p>}
    </div>
  );
}

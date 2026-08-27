import { Fragment, FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import { listarEncargados, EncargadoBasico } from "@/core/api/resources/encargados";
import { listarObras, ObraResumen } from "@/core/api/resources/obras";
import { Horario, listarHorarios } from "@/core/api/resources/horarios";
import {
  crearSeccion,
  borrarSeccion,
  DatosAltaSeccion,
  DatosEdicionSeccion,
  editarSeccion,
  listarSecciones,
  Seccion,
  asignarResponsableTramo,
  listarTrabajadoresResponsables,
  retirarResponsableTramo,
} from "@/core/api/resources/secciones";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import { BotonesModal, Campo, ErrorInline, estilosCampo, Modal } from "./configuracionCompartida";

export default function PanelFrentes() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [obras, setObras] = useState<ObraResumen[] | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [encargados, setEncargados] = useState<EncargadoBasico[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: Seccion | null } | null>(null);
  const [nombre, setNombre] = useState("");
  const [obraId, setObraId] = useState("");
  const [tramoUbicacion, setTramoUbicacion] = useState("");
  const [horarioId, setHorarioId] = useState("");
  const [encargadoIds, setEncargadoIds] = useState<string[]>([]);
  const [responsableIds, setResponsableIds] = useState<string[]>([]);
  const [busquedaResponsable, setBusquedaResponsable] = useState("");
  const [trabajadoresResponsables, setTrabajadoresResponsables] = useState<{ id: string; nombreCompleto: string; categoria: string }[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<Seccion | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([listarSecciones(token), listarHorarios(token), listarEncargados(token), listarTrabajadoresResponsables(token), listarObras(token)])
      .then(([s, h, e, t, o]) => {
        setSecciones(s.secciones);
        setObras(o.obras);
        setHorarios(h.horarios);
        setEncargados(e.usuarios);
        setTrabajadoresResponsables(t.trabajadores);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setNombre("");
    setObraId(obras?.[0]?.id ?? "");
    setTramoUbicacion("");
    setHorarioId("");
    setEncargadoIds([]);
    setResponsableIds([]);
    setBusquedaResponsable("");
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(s: Seccion) {
    setNombre(s.nombre);
    setTramoUbicacion(s.tramoUbicacion ?? "");
    setHorarioId(s.horarioId ?? "");
    setEncargadoIds(s.encargados?.map((e) => e.id) ?? []);
    setResponsableIds(s.responsablesTramo?.map((r) => r.id) ?? []);
    setBusquedaResponsable("");
    setErrorModal(null);
    setModal({ editando: s });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      let seccionGuardada: Seccion;
      if (modal?.editando) {
        const datos: DatosEdicionSeccion = { nombre, horarioId: horarioId || null, encargadoIds, tramoUbicacion: tramoUbicacion || null };
        seccionGuardada = (await editarSeccion(token, modal.editando.id, datos)).seccion;
      } else {
        // El Frente pertenece a una Obra real; se selecciona dinámicamente
        // cuando hay varias y se usa la única disponible como valor inicial.
        const obraIdSeleccionada = obraId || obras?.[0]?.id;
        if (!obraIdSeleccionada) {
          throw new Error("No hay una Obra disponible para crear el Frente.");
        }
        const datos: DatosAltaSeccion = { obraId: obraIdSeleccionada, nombre, horarioId: horarioId || null, encargadoIds, tramoUbicacion: tramoUbicacion || null };
        seccionGuardada = (await crearSeccion(token, datos)).seccion;
      }
      const anteriores = modal?.editando?.responsablesTramo?.map((r) => r.id) ?? [];
      for (const trabajadorId of responsableIds.filter((id) => !anteriores.includes(id))) {
        await asignarResponsableTramo(token, seccionGuardada!.id, trabajadorId);
      }
      for (const trabajadorId of anteriores.filter((id) => !responsableIds.includes(id))) {
        await retirarResponsableTramo(token, seccionGuardada!.id, trabajadorId);
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
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un 409 (ej. sección en
      // uso) cerraba el modal igual, dando sensación de éxito.
      throw err;
    }
  }

  const mapaHorarios = new Map((horarios ?? []).map((h) => [h.id, h.nombre]));

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{cargando ? "Cargando…" : secciones ? `${secciones.length} frente${secciones.length === 1 ? "" : "s"}` : "Frentes"}</span>
        <Boton tamano="pequeno" onClick={abrirAlta}>
          + Nuevo frente
        </Boton>
      </div>

      {cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : error ? (
        <div className="configuracion-error" role="alert">
          <span>No fue posible cargar los frentes.</span>
          <Boton variante="outline" tamano="pequeno" onClick={cargar}>Reintentar</Boton>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Tramo o ubicación</th>
                <th style={{ padding: "10px 12px" }}>Horario</th>
                <th style={{ padding: "10px 12px" }}>Encargado(s) de Frente</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {secciones?.map((s) => (
                <Fragment key={s.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{s.nombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{s.tramoUbicacion || "No especificado"}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{s.horarioId ? mapaHorarios.get(s.horarioId) ?? "—" : "—"}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{s.responsablesTramo?.length ? s.responsablesTramo.map((r) => `${r.nombreCompleto} · ${r.categoria}`).join(", ") : "No asignado"}</td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <Boton variante="outline" tamano="pequeno" onClick={() => abrirEdicion(s)}>
                        Editar
                      </Boton>
                      <Boton variante="outline" tamano="pequeno" onClick={() => setConfirmandoBorrar(s)} style={{ color: "var(--err)" }}>
                        Borrar
                      </Boton>
                    </td>
                  </tr>
                  {erroresFila[s.id] && (
                    <tr>
                    <td colSpan={5} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[s.id]}</td>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar frente" : "Nuevo frente"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} style={estilosCampo} />
            </Campo>
            {!modal.editando && (obras?.length ?? 0) > 1 && (
              <Campo etiqueta="Obra">
                <select required value={obraId} onChange={(e) => setObraId(e.target.value)} style={estilosCampo}>
                  <option value="">Selecciona una Obra</option>
                  {obras?.map((obra) => <option key={obra.id} value={obra.id}>{obra.nombre}</option>)}
                </select>
              </Campo>
            )}
            <Campo etiqueta="Tramo o ubicación de la obra">
              <input type="text" value={tramoUbicacion} onChange={(e) => setTramoUbicacion(e.target.value)} placeholder="No especificado" style={estilosCampo} />
            </Campo>
            <Campo etiqueta="Horario asignado">
              <select value={horarioId} onChange={(e) => setHorarioId(e.target.value)} style={estilosCampo}>
                <option value="">Sin horario</option>
                {horarios?.map((h) => (
                  <option key={h.id} value={h.id}>{h.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Cuentas técnicas con acceso al frente">
              <div className="seleccion-lista" aria-label="Cuentas técnicas con acceso">
                {encargados?.length ? encargados.map((en) => {
                  const seleccionado = encargadoIds.includes(en.id);
                  return (
                    <label className={`seleccion-opcion${seleccionado ? " seleccionada" : ""}`} key={en.id}>
                      <input type="checkbox" checked={seleccionado} onChange={() => setEncargadoIds((actuales) => seleccionado ? actuales.filter((id) => id !== en.id) : [...actuales, en.id])} />
                      <span>{en.trabajadorNombre ? `${en.trabajadorNombre}${en.trabajadorCategoria ? ` · ${en.trabajadorCategoria}` : ""}` : en.username}</span>
                    </label>
                  );
                }) : <span className="seleccion-vacia">No hay cuentas técnicas disponibles.</span>}
              </div>
            </Campo>
            <Campo etiqueta="Responsables operativos del tramo">
              <input
                type="search"
                value={busquedaResponsable}
                onChange={(evento) => setBusquedaResponsable(evento.target.value)}
                placeholder="Buscar trabajador activo…"
                style={{ ...estilosCampo, marginBottom: 7 }}
              />
              <div className="seleccion-lista" aria-label="Responsables operativos del tramo">
                {trabajadoresResponsables.filter((trabajador) => `${trabajador.nombreCompleto} ${trabajador.categoria}`.toLocaleLowerCase().includes(busquedaResponsable.toLocaleLowerCase())).length ? trabajadoresResponsables
                  .filter((trabajador) => `${trabajador.nombreCompleto} ${trabajador.categoria}`.toLocaleLowerCase().includes(busquedaResponsable.toLocaleLowerCase()))
                  .map((trabajador) => {
                    const seleccionado = responsableIds.includes(trabajador.id);
                    return (
                      <label className={`seleccion-opcion${seleccionado ? " seleccionada" : ""}`} key={trabajador.id}>
                        <input type="checkbox" checked={seleccionado} onChange={() => setResponsableIds((actuales) => seleccionado ? actuales.filter((id) => id !== trabajador.id) : [...actuales, trabajador.id])} />
                        <span>{trabajador.nombreCompleto} · {trabajador.categoria}</span>
                      </label>
                    );
                  }) : <span className="seleccion-vacia">No hay trabajadores que coincidan.</span>}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--muted)" }}>Solo trabajadores activos. Puedes seleccionar varios.</span>
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear frente"} />
          </form>
        </Modal>
      )}

      {confirmandoBorrar && (
        <ModalConfirmacion
          titulo="Borrar frente"
          mensaje={
            <>
              Se borrará el frente <strong>{confirmandoBorrar.nombre}</strong>. Esta acción no se puede deshacer.
            </>
          }
          etiquetaConfirmar="Borrar"
          onCancelar={() => setConfirmandoBorrar(null)}
          onConfirmar={async () => {
            await borrar(confirmandoBorrar);
            setConfirmandoBorrar(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tipos de movimiento
// ---------------------------------------------------------------------

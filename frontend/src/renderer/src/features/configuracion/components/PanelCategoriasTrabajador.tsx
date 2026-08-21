import { Fragment, FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import {
  aplicarSueldoATodosDeCategoria,
  crearCategoriaTrabajador,
  borrarCategoriaTrabajador,
  CategoriaTrabajador,
  DatosCategoriaTrabajador,
  editarCategoriaTrabajador,
  listarCategoriasTrabajador,
} from "@/core/api/resources/categoriasTrabajador";
import { listarTrabajadores, Trabajador } from "@/features/trabajadores/api";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import { BotonesModal, Campo, Check, ErrorInline, estilosCampo, Modal, Pill } from "./configuracionCompartida";

function formularioCategoriaVacio(): DatosCategoriaTrabajador {
  return { nombre: "", sueldoBaseDefault: null, esDefault: false };
}

export default function PanelCategoriasTrabajador() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [categorias, setCategorias] = useState<CategoriaTrabajador[] | null>(null);
  const [trabajadores, setTrabajadores] = useState<Trabajador[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: CategoriaTrabajador | null } | null>(null);
  const [formulario, setFormulario] = useState<DatosCategoriaTrabajador>(formularioCategoriaVacio());
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<CategoriaTrabajador | null>(null);

  // "Aplicar a todos" es una acción separada del CRUD normal, con su propio
  // conteo REAL (calculado sobre los trabajadores ya cargados, no una
  // estimación) mostrado antes de poder confirmar — ver categoriaTrabajador.
  // service.ts para por qué esto es seguro respecto a nómina ya generada.
  const [aplicando, setAplicando] = useState<CategoriaTrabajador | null>(null);
  const [nuevoSueldoAplicar, setNuevoSueldoAplicar] = useState("");
  const [errorAplicar, setErrorAplicar] = useState<string | null>(null);
  const [guardandoAplicar, setGuardandoAplicar] = useState(false);

  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([listarCategoriasTrabajador(token), listarTrabajadores(token)])
      .then(([c, t]) => {
        setCategorias(c.categorias);
        setTrabajadores(t.trabajadores);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setFormulario(formularioCategoriaVacio());
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(c: CategoriaTrabajador) {
    setFormulario({
      nombre: c.nombre,
      sueldoBaseDefault: c.sueldoBaseDefault === null ? null : Number(c.sueldoBaseDefault),
      esDefault: c.esDefault,
    });
    setErrorModal(null);
    setModal({ editando: c });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      if (modal?.editando) {
        await editarCategoriaTrabajador(token, modal.editando.id, formulario);
      } else {
        await crearCategoriaTrabajador(token, formulario);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(c: CategoriaTrabajador) {
    setErroresFila((p) => ({ ...p, [c.id]: "" }));
    try {
      await borrarCategoriaTrabajador(token, c.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [c.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un 409 (ej. categoría
      // en uso) cerraba el modal igual, dando sensación de éxito.
      throw err;
    }
  }

  function abrirAplicar(c: CategoriaTrabajador) {
    setNuevoSueldoAplicar(c.sueldoBaseDefault ?? "");
    setErrorAplicar(null);
    setAplicando(c);
  }

  const conteoAplicar = aplicando
    ? (trabajadores ?? []).filter((t) => t.categoria === aplicando.nombre && t.estatus === "activo").length
    : 0;

  async function enviarAplicar(e: FormEvent) {
    e.preventDefault();
    if (!aplicando) return;
    setErrorAplicar(null);
    setGuardandoAplicar(true);
    try {
      await aplicarSueldoATodosDeCategoria(token, aplicando.id, Number(nuevoSueldoAplicar));
      setAplicando(null);
      cargar();
    } catch (err) {
      setErrorAplicar(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardandoAplicar(false);
    }
  }

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{categorias ? `${categorias.length} categoría${categorias.length === 1 ? "" : "s"}` : "Cargando…"}</span>
        <Boton tamano="pequeno" onClick={abrirAlta}>
          + Nueva categoría
        </Boton>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--muted)", padding: "12px 20px 0" }}>
        El sueldo por defecto solo prellena el campo al dar de alta un trabajador nuevo — no cambia el sueldo de
        trabajadores ya existentes salvo que uses "Aplicar a todos".
      </p>

      {error ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Sueldo por defecto</th>
                <th style={{ padding: "10px 12px" }}>Default</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias?.map((c) => (
                <Fragment key={c.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{c.nombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>
                      {c.sueldoBaseDefault === null ? "—" : `$${Number(c.sueldoBaseDefault).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={c.esDefault} /></td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Boton variante="outline" tamano="pequeno" onClick={() => abrirEdicion(c)}>
                        Editar
                      </Boton>
                      <Boton variante="outline" tamano="pequeno" onClick={() => abrirAplicar(c)}>
                        Aplicar a todos
                      </Boton>
                      <Boton variante="outline" tamano="pequeno" onClick={() => setConfirmandoBorrar(c)} style={{ color: "var(--err)" }}>
                        Borrar
                      </Boton>
                    </td>
                  </tr>
                  {erroresFila[c.id] && (
                    <tr>
                      <td colSpan={4} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[c.id]}</td>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar categoría" : "Nueva categoría"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} style={estilosCampo} />
            </Campo>
            <Campo etiqueta="Sueldo por defecto (opcional)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={formulario.sueldoBaseDefault ?? ""}
                onChange={(e) => setFormulario((f) => ({ ...f, sueldoBaseDefault: e.target.value === "" ? null : Number(e.target.value) }))}
                style={estilosCampo}
              />
            </Campo>
            <Check
              etiqueta="Usar como sueldo por defecto general (sin categoría coincidente)"
              checked={formulario.esDefault}
              onChange={(v) => setFormulario((f) => ({ ...f, esDefault: v }))}
            />
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear categoría"} />
          </form>
        </Modal>
      )}

      {aplicando && (
        <Modal onClose={() => setAplicando(null)}>
          <form onSubmit={enviarAplicar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>Aplicar sueldo a todos</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>
              Se actualizará el sueldo base de <strong>{conteoAplicar}</strong> trabajador{conteoAplicar === 1 ? "" : "es"} activo
              {conteoAplicar === 1 ? "" : "s"} con categoría <strong>{aplicando.nombre}</strong>. Esta acción no se puede deshacer
              automáticamente.
            </p>
            <ErrorInline mensaje={errorAplicar} />
            <Campo etiqueta="Nuevo sueldo base">
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={nuevoSueldoAplicar}
                onChange={(e) => setNuevoSueldoAplicar(e.target.value)}
                style={estilosCampo}
              />
            </Campo>
            <BotonesModal guardando={guardandoAplicar} onCancelar={() => setAplicando(null)} etiqueta={`Aplicar a ${conteoAplicar}`} />
          </form>
        </Modal>
      )}

      {confirmandoBorrar && (
        <ModalConfirmacion
          titulo="Borrar categoría"
          mensaje={
            <>
              Se borrará la categoría <strong>{confirmandoBorrar.nombre}</strong>. Esta acción no se puede deshacer.
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

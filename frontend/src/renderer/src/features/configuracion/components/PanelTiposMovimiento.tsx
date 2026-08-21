import { Fragment, FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import {
  crearTipoMovimiento,
  borrarTipoMovimiento,
  DatosTipoMovimiento,
  editarTipoMovimiento,
  listarTiposMovimiento,
  TipoMovimiento,
} from "@/core/api/resources/tiposMovimiento";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import { BotonesModal, Campo, Check, ErrorInline, estilosCampo, Modal, Pill } from "./configuracionCompartida";

function formularioTipoVacio(): DatosTipoMovimiento {
  return { nombre: "", cuentaComoDiaTrabajado: false, esInformativo: false, requiereAutorizacion: false };
}

export default function PanelTiposMovimiento() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [tipos, setTipos] = useState<TipoMovimiento[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: TipoMovimiento | null } | null>(null);
  const [formulario, setFormulario] = useState<DatosTipoMovimiento>(formularioTipoVacio());
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<TipoMovimiento | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    listarTiposMovimiento(token)
      .then((r) => setTipos(r.tiposMovimiento))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setFormulario(formularioTipoVacio());
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(t: TipoMovimiento) {
    setFormulario({ nombre: t.nombre, cuentaComoDiaTrabajado: t.cuentaComoDiaTrabajado, esInformativo: t.esInformativo, requiereAutorizacion: t.requiereAutorizacion });
    setErrorModal(null);
    setModal({ editando: t });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      if (modal?.editando) {
        await editarTipoMovimiento(token, modal.editando.id, formulario);
      } else {
        await crearTipoMovimiento(token, formulario);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(t: TipoMovimiento) {
    setErroresFila((p) => ({ ...p, [t.id]: "" }));
    try {
      await borrarTipoMovimiento(token, t.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [t.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un 409 (ej. tipo de
      // movimiento en uso) cerraba el modal igual, dando sensación de éxito.
      throw err;
    }
  }

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{tipos ? `${tipos.length} tipo${tipos.length === 1 ? "" : "s"}` : "Cargando…"}</span>
        <Boton tamano="pequeno" onClick={abrirAlta}>
          + Nuevo tipo
        </Boton>
      </div>

      {error ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
      ) : cargando ? (
        <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Nombre</th>
                <th style={{ padding: "10px 12px" }}>Cuenta como día trabajado</th>
                <th style={{ padding: "10px 12px" }}>Informativo</th>
                <th style={{ padding: "10px 12px" }}>Requiere autorización</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tipos?.map((t) => (
                <Fragment key={t.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{t.nombre}</td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.cuentaComoDiaTrabajado} /></td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.esInformativo} /></td>
                    <td style={{ padding: "11px 12px" }}><Pill activo={t.requiereAutorizacion} /></td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <Boton variante="outline" tamano="pequeno" onClick={() => abrirEdicion(t)}>
                        Editar
                      </Boton>
                      <Boton variante="outline" tamano="pequeno" onClick={() => setConfirmandoBorrar(t)} style={{ color: "var(--err)" }}>
                        Borrar
                      </Boton>
                    </td>
                  </tr>
                  {erroresFila[t.id] && (
                    <tr>
                      <td colSpan={5} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[t.id]}</td>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar tipo de movimiento" : "Nuevo tipo de movimiento"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} style={estilosCampo} />
            </Campo>
            <Check etiqueta="Cuenta como día trabajado" checked={formulario.cuentaComoDiaTrabajado} onChange={(v) => setFormulario((f) => ({ ...f, cuentaComoDiaTrabajado: v }))} />
            <Check etiqueta="Es informativo" checked={formulario.esInformativo} onChange={(v) => setFormulario((f) => ({ ...f, esInformativo: v }))} />
            <Check etiqueta="Requiere autorización" checked={formulario.requiereAutorizacion} onChange={(v) => setFormulario((f) => ({ ...f, requiereAutorizacion: v }))} />
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear tipo"} />
          </form>
        </Modal>
      )}

      {confirmandoBorrar && (
        <ModalConfirmacion
          titulo="Borrar tipo de movimiento"
          mensaje={
            <>
              Se borrará el tipo <strong>{confirmandoBorrar.nombre}</strong>. Esta acción no se puede deshacer.
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
// Tarifa hora extra
// ---------------------------------------------------------------------

import { Fragment, FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import { crearHorario, borrarHorario, DatosHorario, editarHorario, Horario, listarHorarios } from "@/core/api/resources/horarios";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import { BotonesModal, Campo, ErrorInline, estilosCampo, Modal } from "./configuracionCompartida";

function aHHMM(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "";
}

function formularioHorarioVacio(): DatosHorario {
  return { nombre: "", horaEntrada: "08:00", horaSalida: "17:00", toleranciaMinutos: 10, recesoInicio: "", recesoFin: "" };
}

export default function PanelHorarios() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ editando: Horario | null } | null>(null);
  const [formulario, setFormulario] = useState<DatosHorario>(formularioHorarioVacio());
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [confirmandoBorrar, setConfirmandoBorrar] = useState<Horario | null>(null);

  function cargar() {
    setCargando(true);
    setError(null);
    listarHorarios(token)
      .then((r) => setHorarios(r.horarios))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  function abrirAlta() {
    setFormulario(formularioHorarioVacio());
    setErrorModal(null);
    setModal({ editando: null });
  }

  function abrirEdicion(h: Horario) {
    setFormulario({
      nombre: h.nombre,
      horaEntrada: aHHMM(h.horaEntrada),
      horaSalida: aHHMM(h.horaSalida),
      toleranciaMinutos: h.toleranciaMinutos,
      recesoInicio: aHHMM(h.recesoInicio) || "",
      recesoFin: aHHMM(h.recesoFin) || "",
    });
    setErrorModal(null);
    setModal({ editando: h });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    const datos: DatosHorario = {
      ...formulario,
      recesoInicio: formulario.recesoInicio || null,
      recesoFin: formulario.recesoFin || null,
    };
    try {
      if (modal?.editando) {
        await editarHorario(token, modal.editando.id, datos);
      } else {
        await crearHorario(token, datos);
      }
      setModal(null);
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(h: Horario) {
    setErroresFila((p) => ({ ...p, [h.id]: "" }));
    try {
      await borrarHorario(token, h.id);
      cargar();
    } catch (err) {
      setErroresFila((p) => ({ ...p, [h.id]: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor." }));
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un 409 (ej. horario en
      // uso) cerraba el modal igual, dando sensación de éxito.
      throw err;
    }
  }

  return (
    <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{horarios ? `${horarios.length} horario${horarios.length === 1 ? "" : "s"}` : "Cargando…"}</span>
        <Boton tamano="pequeno" onClick={abrirAlta}>
          + Nuevo horario
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
                <th style={{ padding: "10px 12px" }}>Entrada</th>
                <th style={{ padding: "10px 12px" }}>Salida</th>
                <th style={{ padding: "10px 12px" }}>Receso</th>
                <th style={{ padding: "10px 12px" }}>Tolerancia</th>
                <th style={{ padding: "10px 12px" }}>Frentes que lo usan</th>
                <th style={{ padding: "10px 20px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {horarios?.map((h) => (
                <Fragment key={h.id}>
                  <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{h.nombre}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{aHHMM(h.horaEntrada)}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{aHHMM(h.horaSalida)}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {h.recesoInicio && h.recesoFin ? `${aHHMM(h.recesoInicio)}–${aHHMM(h.recesoFin)}` : "—"}
                    </td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{h.toleranciaMinutos} min</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{h.secciones?.length ? h.secciones.map((s) => s.nombre).join(", ") : "—"}</td>
                    <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                      <Boton variante="outline" tamano="pequeno" onClick={() => abrirEdicion(h)}>
                        Editar
                      </Boton>
                      <Boton variante="outline" tamano="pequeno" onClick={() => setConfirmandoBorrar(h)} style={{ color: "var(--err)" }}>
                        Borrar
                      </Boton>
                    </td>
                  </tr>
                  {erroresFila[h.id] && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>{erroresFila[h.id]}</td>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>{modal.editando ? "Editar horario" : "Nuevo horario"}</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Nombre">
              <input type="text" required value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} style={estilosCampo} />
            </Campo>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Hora de entrada">
                  <input type="time" required value={formulario.horaEntrada} onChange={(e) => setFormulario((f) => ({ ...f, horaEntrada: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Hora de salida">
                  <input type="time" required value={formulario.horaSalida} onChange={(e) => setFormulario((f) => ({ ...f, horaSalida: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Receso inicio (opcional)">
                  <input type="time" value={formulario.recesoInicio ?? ""} onChange={(e) => setFormulario((f) => ({ ...f, recesoInicio: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Receso fin (opcional)">
                  <input type="time" value={formulario.recesoFin ?? ""} onChange={(e) => setFormulario((f) => ({ ...f, recesoFin: e.target.value }))} style={estilosCampo} />
                </Campo>
              </div>
            </div>
            <Campo etiqueta="Tolerancia (minutos)">
              <input
                type="number"
                min={0}
                required
                value={formulario.toleranciaMinutos}
                onChange={(e) => setFormulario((f) => ({ ...f, toleranciaMinutos: Number(e.target.value) }))}
                style={estilosCampo}
              />
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(null)} etiqueta={modal.editando ? "Guardar cambios" : "Crear horario"} />
          </form>
        </Modal>
      )}

      {confirmandoBorrar && (
        <ModalConfirmacion
          titulo="Borrar horario"
          mensaje={
            <>
              Se borrará el horario <strong>{confirmandoBorrar.nombre}</strong>. Esta acción no se puede deshacer.
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
// Secciones
// ---------------------------------------------------------------------

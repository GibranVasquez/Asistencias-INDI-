import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { RolUsuario } from "@/features/auth/api";
import { ApiError } from "@/core/api/client";
import { listarSecciones, Seccion } from "@/core/api/resources/secciones";
import {
  cambiarEstadoUsuario,
  crearUsuario,
  DatosAltaUsuario,
  listarUsuarios,
  resetearPasswordUsuario,
  ROLES_CREABLES,
  UsuarioListado,
} from "@/features/usuarios/api";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import CampoContrasena from "@/shared/components/CampoContrasena";
import Boton from "@/shared/components/Boton";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import ModalConfirmacion from "@/shared/components/ModalConfirmacion";
import ResumenModulo from "@/shared/components/ResumenModulo";
import EncabezadoSeccion from "@/shared/components/EncabezadoSeccion";

const ETIQUETA_ROL: Record<RolUsuario, string> = {
  trabajador: "Trabajador",
  recepcion: "Recepción",
  encargado_seccion: "Responsable del tramo",
  rh: "Recursos Humanos",
  administrador: "Administrador",
};

const estilosCampo = { padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" };

function formularioVacio(): DatosAltaUsuario {
  return { username: "", password: "", rol: "recepcion", seccionesAsignadas: [] };
}

export default function UsuariosPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [usuarios, setUsuarios] = useState<UsuarioListado[] | null>(null);
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [formulario, setFormulario] = useState<DatosAltaUsuario>(formularioVacio());
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [erroresFila, setErroresFila] = useState<Record<string, string>>({});
  const [filaEnProceso, setFilaEnProceso] = useState<string | null>(null);
  const [confirmandoEstado, setConfirmandoEstado] = useState<UsuarioListado | null>(null);

  const [reseteando, setReseteando] = useState<UsuarioListado | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState("");
  const [errorReseteo, setErrorReseteo] = useState<string | null>(null);
  const [guardandoReseteo, setGuardandoReseteo] = useState(false);


  function cargar() {
    setCargando(true);
    setError(null);
    Promise.all([listarUsuarios(token), listarSecciones(token)])
      .then(([u, s]) => {
        setUsuarios(u.usuarios);
        setSecciones(s.secciones);
      })
      .catch((err) => {
        const mensaje =
          err instanceof ApiError ? (err.status === 403 ? "no disponible para tu rol" : err.message) : "No se pudo conectar con el servidor.";
        setError(mensaje);
      })
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [token]);

  async function enviarAlta(e: FormEvent) {
    e.preventDefault();
    setErrorAlta(null);
    setGuardando(true);
    try {
      await crearUsuario(token, {
        username: formulario.username,
        password: formulario.password,
        rol: formulario.rol,
        seccionesAsignadas: formulario.rol === "encargado_seccion" ? formulario.seccionesAsignadas : undefined,
      });
      setMostrarAlta(false);
      setFormulario(formularioVacio());
      cargar();
    } catch (err) {
      setErrorAlta(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(u: UsuarioListado) {
    setErroresFila((prev) => ({ ...prev, [u.id]: "" }));
    setFilaEnProceso(u.id);
    try {
      await cambiarEstadoUsuario(token, u.id, !u.activo);
      cargar();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.";
      setErroresFila((prev) => ({ ...prev, [u.id]: mensaje }));
      // Relanzar: el ModalConfirmacion que llama a esta función solo cierra
      // el modal si onConfirmar resuelve — sin esto, un 409 (ej. cuenta en
      // uso) cerraba el modal igual, dando sensación de éxito.
      throw err;
    } finally {
      setFilaEnProceso(null);
    }
  }

  async function enviarReseteo(e: FormEvent) {
    e.preventDefault();
    if (!reseteando) return;
    setErrorReseteo(null);
    setGuardandoReseteo(true);
    try {
      await resetearPasswordUsuario(token, reseteando.id, passwordTemporal);
      setReseteando(null);
      setPasswordTemporal("");
    } catch (err) {
      setErrorReseteo(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardandoReseteo(false);
    }
  }

  const vinculoDe = useMemo(
    () => (u: UsuarioListado) => {
      if (u.rol === "encargado_seccion") {
        return u.seccionesAsignadas.length > 0 ? u.seccionesAsignadas.map((s) => s.nombre).join(", ") : "—";
      }
      if (u.trabajadorNombre) return u.trabajadorNombre;
      return "—";
    },
    []
  );
  const usuariosActivos = usuarios?.filter((u) => u.activo).length ?? 0;
  const rolesEnUso = new Set(usuarios?.map((u) => u.rol) ?? []).size;

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <EncabezadoPagina titulo="Usuarios y accesos" descripcion="Administra cuentas, roles y acceso al sistema." metadata="Centro de accesos" accion={<Boton
            onClick={() => {
              setFormulario(formularioVacio());
              setErrorAlta(null);
              setMostrarAlta(true);
            }}
          >
            + Nueva cuenta
          </Boton>
        } />

      {usuarios && (
        <ResumenModulo
          etiqueta="Control de acceso"
          icono="◇"
          items={[
            { etiqueta: "Cuentas", valor: usuarios.length },
            { etiqueta: "Activas", valor: usuariosActivos, tono: "ok" },
            { etiqueta: "Inactivas", valor: usuarios.length - usuariosActivos, tono: usuarios.length > usuariosActivos ? "warn" : "neutral" },
            { etiqueta: "Roles en uso", valor: rolesEnUso },
          ]}
        />
      )}

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        <EncabezadoSeccion titulo="Cuentas autorizadas" descripcion="Usuarios con acceso administrativo u operativo al sistema." />
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 20px" }}>Usuario</th>
                  <th style={{ padding: "10px 12px" }}>Rol</th>
                  <th style={{ padding: "10px 12px" }}>Estatus</th>
                  <th style={{ padding: "10px 12px" }}>Vínculo</th>
                  <th style={{ padding: "10px 12px" }}>Creado</th>
                  <th style={{ padding: "10px 20px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u) => (
                  <Fragment key={u.id}>
                    <tr style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                      <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>
                        {u.username}
                        {u.id === sesion!.usuario.id && <span style={{ color: "var(--muted)", fontWeight: 500 }}> (tú)</span>}
                      </td>
                      <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{ETIQUETA_ROL[u.rol] ?? u.rol}</td>
                      <td style={{ padding: "11px 12px" }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: u.activo ? "var(--ok)" : "var(--err)",
                            background: u.activo ? "rgba(47,174,102,.12)" : "rgba(229,72,77,.12)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{vinculoDe(u)}</td>
                      <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{new Date(u.creadoEn).toLocaleDateString("es-MX")}</td>
                      <td style={{ padding: "11px 20px", display: "flex", gap: 8 }}>
                        <Boton
                          variante="outline"
                          tamano="pequeno"
                          onClick={() => {
                            setReseteando(u);
                            setPasswordTemporal("");
                            setErrorReseteo(null);
                          }}
                        >
                          Resetear contraseña
                        </Boton>
                        <Boton
                          variante="outline"
                          tamano="pequeno"
                          onClick={() => setConfirmandoEstado(u)}
                          disabled={filaEnProceso === u.id}
                          style={{ color: u.activo ? "var(--err)" : "var(--ok)" }}
                        >
                          {filaEnProceso === u.id ? "…" : u.activo ? "Dar de baja" : "Reactivar"}
                        </Boton>
                      </td>
                    </tr>
                    {erroresFila[u.id] && (
                      <tr>
                        <td colSpan={6} style={{ padding: "0 20px 10px", color: "var(--err)", fontSize: 12.5 }}>
                          {erroresFila[u.id]}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Nueva cuenta</h2>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Usuario
              <input
                type="text"
                required
                value={formulario.username}
                onChange={(e) => setFormulario((f) => ({ ...f, username: e.target.value }))}
                style={estilosCampo}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Contraseña
              <CampoContrasena
                required
                value={formulario.password}
                onChange={(v) => setFormulario((f) => ({ ...f, password: v }))}
                style={estilosCampo}
                mostrarRequisitos
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Rol
              <select
                value={formulario.rol}
                onChange={(e) => setFormulario((f) => ({ ...f, rol: e.target.value as DatosAltaUsuario["rol"], seccionesAsignadas: [] }))}
                style={estilosCampo}
              >
                {ROLES_CREABLES.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </select>
            </label>

            {formulario.rol === "encargado_seccion" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                Frentes asignados
                <select
                  multiple
                  required
                  value={formulario.seccionesAsignadas}
                  onChange={(e) =>
                    setFormulario((f) => ({ ...f, seccionesAsignadas: Array.from(e.target.selectedOptions, (o) => o.value) }))
                  }
                  style={{ ...estilosCampo, minHeight: 90 }}
                >
                  {secciones?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {errorAlta && (
              <div style={{ fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px" }}>
                {errorAlta}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Boton variante="outline" type="button" onClick={() => setMostrarAlta(false)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardando} style={{ flex: 1 }}>
                {guardando ? "Guardando…" : "Crear cuenta"}
              </Boton>
            </div>
          </form>
        </div>
      )}

      {reseteando && (
        <div
          className="modal-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setReseteando(null)}
        >
          <form
            className="modal-panel"
            onSubmit={enviarReseteo}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 14, padding: 26, width: 380, display: "flex", flexDirection: "column", gap: 14 }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Resetear contraseña</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Asigna una contraseña temporal para <strong>{reseteando.username}</strong>. Deberá cambiarla por una propia en su
              siguiente inicio de sesión.
            </p>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
              Contraseña temporal
              <CampoContrasena
                required
                autoFocus
                value={passwordTemporal}
                onChange={setPasswordTemporal}
                style={estilosCampo}
                mostrarRequisitos
              />
            </label>

            {errorReseteo && (
              <div style={{ fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px" }}>
                {errorReseteo}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Boton variante="outline" type="button" onClick={() => setReseteando(null)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardandoReseteo} style={{ flex: 1 }}>
                {guardandoReseteo ? "Guardando…" : "Resetear"}
              </Boton>
            </div>
          </form>
        </div>
      )}

      {confirmandoEstado && (
        <ModalConfirmacion
          titulo={confirmandoEstado.activo ? "Dar de baja a la cuenta" : "Reactivar la cuenta"}
          mensaje={
            confirmandoEstado.activo ? (
              <>
                <strong>{confirmandoEstado.username}</strong> no podrá iniciar sesión hasta que se reactive de nuevo.
              </>
            ) : (
              <>
                <strong>{confirmandoEstado.username}</strong> podrá volver a iniciar sesión con su contraseña actual.
              </>
            )
          }
          etiquetaConfirmar={confirmandoEstado.activo ? "Dar de baja" : "Reactivar"}
          peligroso={confirmandoEstado.activo}
          onCancelar={() => setConfirmandoEstado(null)}
          onConfirmar={async () => {
            await alternarEstado(confirmandoEstado);
            setConfirmandoEstado(null);
          }}
        />
      )}
    </div>
  );
}

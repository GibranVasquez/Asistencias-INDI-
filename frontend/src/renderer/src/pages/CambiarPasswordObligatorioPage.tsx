import { FormEvent, useState } from "react";
import { cambiarPassword } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import Boton from "../components/Boton";

const estilosCampo = {
  padding: "12px 14px",
  border: "1.5px solid var(--line)",
  borderRadius: 9,
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--surface)",
  color: "var(--ink)",
};

// Bloquea el resto de la app (montado directamente por App.tsx, sin ruta
// propia) mientras sesion.usuario.requiereCambioPassword sea true — la
// cuenta viene de un reseteo por administrador y no debe seguir operando
// con la contraseña temporal.
export default function CambiarPasswordObligatorioPage() {
  const { sesion, actualizarUsuario } = useAuth();
  const token = sesion!.token;

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (passwordNueva !== confirmar) {
      setError("La contraseña nueva y la confirmación no coinciden.");
      return;
    }

    setCargando(true);
    try {
      await cambiarPassword(token, passwordActual, passwordNueva);
      await actualizarUsuario({ requiereCambioPassword: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <form onSubmit={manejarEnvio} style={{ width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Cambia tu contraseña</h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
          Un administrador reseteó tu contraseña. Antes de continuar, define una nueva propia.
        </p>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Contraseña temporal actual
            <PasswordInput required autoFocus value={passwordActual} onChange={setPasswordActual} style={estilosCampo} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Contraseña nueva
            <PasswordInput required value={passwordNueva} onChange={setPasswordNueva} style={estilosCampo} mostrarRequisitos />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Confirmar contraseña nueva
            <PasswordInput required value={confirmar} onChange={setConfirmar} style={estilosCampo} />
          </label>

          {error && (
            <div style={{ fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px" }}>
              {error}
            </div>
          )}

          <Boton type="submit" disabled={cargando} style={{ marginTop: 6, width: "100%", fontSize: 15 }}>
            {cargando ? "Guardando…" : "Cambiar contraseña"}
          </Boton>
        </div>
      </form>
    </div>
  );
}

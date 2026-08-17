import { SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/features/auth/api";
import { asset } from "@/shared/assets";
import { ApiError } from "@/core/api/client";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import CampoContrasena from "@/shared/components/CampoContrasena";
import AlternarTema from "@/shared/components/AlternarTema";
import Boton from "@/shared/components/Boton";

export default function LoginPage() {
  const { iniciarSesion } = useAutenticacion();
  const navegar = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { token, usuario } = await login(username, password);
      // El indicador de si quedó realmente persistida vive en AdminLayout
      // (sesionPersistida del contexto) — persistente en toda la sesión,
      // no un aviso de una sola vez que desaparece al navegar.
      await iniciarSesion({ token, usuario }, recordar);
      await navegar("/panel/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="precision-login">
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 2 }}>
        <AlternarTema />
      </div>
      <section
        className="precision-login-brand"
        style={{
          width: "46%",
          background: "var(--indi)",
          backgroundImage: "var(--dots)",
          backgroundSize: "15px 15px",
          color: "#fff",
          padding: "56px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(160deg, rgba(46,99,199,.35), rgba(11,46,107,.9))",
          }}
        />
        <div className="precision-rings precision-login-rings" aria-hidden="true"><i /><i /><i /></div>
        <img
          src={asset("assets/indi-logo.png")}
          alt="INDI"
          style={{ height: 38, borderRadius: 6, position: "relative", zIndex: 1, alignSelf: "flex-start" }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="precision-eyebrow">Control · Personal · Operación</span>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.08 }}>INDI Asistencia</h1>
          <p style={{ fontSize: 16, color: "var(--pastel)", marginTop: 16, maxWidth: 340, lineHeight: 1.5 }}>
            Control de asistencia y gestión operativa para personal administrativo y frentes de trabajo.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>
          Grupo INDI · Sistema de control operativo
        </div>
      </section>

      <section className="precision-login-access">
        <form className="login-panel" onSubmit={manejarEnvio} style={{ width: "100%", maxWidth: 360 }}>
          <span className="precision-form-mark" aria-hidden="true" />
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Iniciar sesión</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>Acceso para personal administrativo</p>

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
            >
              Usuario
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
                style={{
                  padding: "12px 14px",
                  border: "1.5px solid var(--line)",
                  borderRadius: 9,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              />
            </label>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
            >
              Contraseña
              <CampoContrasena
                value={password}
                onChange={setPassword}
                required
                style={{
                  padding: "12px 14px",
                  border: "1.5px solid var(--line)",
                  borderRadius: 9,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  letterSpacing: ".2em",
                }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--indi2)" }}
              />
              Recordarme
            </label>

            {error && (
              <div
                className="mensaje-estado"
                style={{
                  fontSize: 13,
                  color: "var(--err)",
                  background: "rgba(229,72,77,.1)",
                  border: "1px solid rgba(229,72,77,.25)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                {error}
              </div>
            )}

            <Boton type="submit" disabled={cargando} style={{ marginTop: 6, width: "100%", fontSize: 15 }}>
              {cargando ? "Ingresando…" : "Ingresar al panel"}
            </Boton>
          </div>
        </form>
      </section>
    </main>
  );
}

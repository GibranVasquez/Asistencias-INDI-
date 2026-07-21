import { SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { asset } from "../assets";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(true);
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
      navegar("/panel/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ height: "100vh", display: "flex" }}>
      <div
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
        <img
          src={asset("assets/indi-logo.png")}
          alt="INDI"
          style={{ height: 38, borderRadius: 6, position: "relative", zIndex: 1, alignSelf: "flex-start" }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.08 }}>
            Sistema de control
            <br />
            de asistencia
          </h1>
          <p style={{ fontSize: 16, color: "var(--pastel)", marginTop: 16, maxWidth: 340, lineHeight: 1.5 }}>
            Panel administrativo. El registro de trabajadores se realiza por huella dactilar en el kiosco.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,.6)" }}>
          Grupo INDI · Tren Golfo de México · v0.1
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <form onSubmit={manejarEnvio} style={{ width: "100%", maxWidth: 360 }}>
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={cargando}
              style={{
                marginTop: 6,
                padding: 13,
                background: "var(--indi)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                fontSize: 15,
                fontWeight: 700,
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? "Ingresando…" : "Ingresar al panel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
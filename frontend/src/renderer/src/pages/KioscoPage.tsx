import { SubmitEvent, useEffect, useRef, useState } from "react";
import { AsistenciaListada, obtenerAsistenciaReciente, registrarAsistencia } from "../api/asistencias";
import { loginTerminal } from "../api/auth";
import { asset } from "../assets";
import { ApiError } from "../api/client";
import { Horario, listarHorarios } from "../api/horarios";
import { listarSecciones, Seccion } from "../api/secciones";
import { ConfigKiosco, useTerminal } from "../context/TerminalContext";

type EstadoKiosco = "idle" | "scanning" | "success" | "error";

// Flag de COMPILACION, no de UI: VITE_ENABLE_MODO_PRUEBA se resuelve en
// tiempo de build (Vite reemplaza import.meta.env.VITE_* con un literal), asi
// que si esta ausente/false el bundler elimina el bloque de "modo de prueba"
// del build de produccion — no basta con no mostrarlo, no debe existir en el
// codigo empaquetado que corre en un kiosco real. Ver .env.development.
const MODO_PRUEBA_HABILITADO = import.meta.env.VITE_ENABLE_MODO_PRUEBA === "true";

function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function aHoraHHMM(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

const iconoHuella = (
  <svg width="92" height="92" viewBox="0 0 100 100" fill="none" stroke="var(--white)" strokeWidth={3.2} strokeLinecap="round">
    <path d="M22 62 a30 32 0 0 1 56 0" />
    <path d="M30 64 a22 24 0 0 1 40 0" />
    <path d="M38 66 a14 16 0 0 1 24 0" />
    <path d="M46 68 a6 8 0 0 1 12 0" />
    <path d="M28 74 q4 8 4 16" />
    <path d="M72 74 q-4 8 -4 16" />
    <path d="M50 60 v34" />
  </svg>
);

export default function KioscoPage() {
  const { sesion, config, restaurandoSesion, errorAlmacenamiento, iniciarSesion, cerrarSesion, guardarConfig, limpiarConfig } = useTerminal();

  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (restaurandoSesion) {
    return <div style={{ height: "100vh", background: "var(--indi)" }} aria-label="Restaurando sesión del Terminal" />;
  }

  if (!sesion) {
    return <LoginTerminalForm onListo={iniciarSesion} errorAlmacenamiento={errorAlmacenamiento} />;
  }

  if (!config) {
    return <ConfigForm token={sesion.token} onGuardar={guardarConfig} />;
  }

  if (config.modo === "confirmacion") {
    return (
      <PantallaConfirmacion
        ahora={ahora}
        token={sesion.token}
        onCerrarSesion={cerrarSesion}
        onReconfigurar={limpiarConfig}
      />
    );
  }

  // Instalaciones previas a que existiera "modo" en ConfigKiosco guardaron
  // solo {seccionId, turno} — siguen cayendo aquí correctamente (modo
  // undefined !== "confirmacion"). Si por alguna razón faltan (localStorage
  // corrupto a mano, etc.), se fuerza a reconfigurar en vez de arriesgar un
  // registro de asistencia con seccionId/turno vacíos.
  if (!config.seccionId || !config.turno) {
    return <ConfigForm token={sesion.token} onGuardar={guardarConfig} />;
  }

  return (
    <PantallaKiosco
      ahora={ahora}
      token={sesion.token}
      config={{ seccionId: config.seccionId, turno: config.turno }}
      onCerrarSesion={cerrarSesion}
      onReconfigurar={limpiarConfig}
    />
  );
}

function LoginTerminalForm({
  onListo,
  errorAlmacenamiento,
}: {
  onListo: ReturnType<typeof useTerminal>["iniciarSesion"];
  errorAlmacenamiento: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { token, terminal } = await loginTerminal(username, password);
      await onListo({ token, terminal });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la sesión en el almacenamiento seguro del equipo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--indi)",
        backgroundImage: "var(--dots)",
        backgroundSize: "16px 16px",
      }}
    >
      <form
        onSubmit={manejarEnvio}
        style={{
          width: 360,
          background: "color-mix(in srgb, var(--white) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--white) 18%, transparent)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800 }}>Activar terminal</h1>
        <p style={{ color: "var(--pastel)", fontSize: 13.5, marginTop: 6 }}>
          Credenciales del dispositivo (no las de un trabajador).
        </p>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text"
            placeholder="Usuario del terminal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            style={{ padding: "12px 14px", borderRadius: 9, border: "none", fontSize: 14 }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "12px 14px", borderRadius: 9, border: "none", fontSize: 14 }}
          />
          {(error || errorAlmacenamiento) && (
            <div style={{ color: "#ffb4b6", fontSize: 13 }}>{error || errorAlmacenamiento}</div>
          )}
          <button
            type="submit"
            disabled={cargando}
            style={{
              padding: 13,
              background: "var(--indi2)",
              color: "var(--white)",
              border: "none",
              borderRadius: 9,
              fontSize: 15,
              fontWeight: 700,
              opacity: cargando ? 0.7 : 1,
            }}
          >
            {cargando ? "Activando…" : "Activar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfigForm({ token, onGuardar }: { token: string; onGuardar: (config: ConfigKiosco) => void }) {
  const [modo, setModo] = useState<"marcacion" | "confirmacion">("marcacion");
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [seccionId, setSeccionId] = useState("");
  const [turno, setTurno] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function cargarCatalogos() {
    setCargando(true);
    setError(null);
    try {
      const [resSecciones, resHorarios] = await Promise.all([listarSecciones(token), listarHorarios(token)]);
      setSecciones(resSecciones.secciones);
      setHorarios(resHorarios.horarios);
      setSeccionId((actual) => actual || resSecciones.secciones[0]?.id || "");
      setTurno((actual) => actual || resHorarios.horarios[0]?.nombre || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cargarCatalogos();
  }, []);

  function manejarEnvio(evento: SubmitEvent) {
    evento.preventDefault();
    if (modo === "confirmacion") {
      onGuardar({ modo: "confirmacion" });
      return;
    }
    if (!seccionId || !turno) return;
    onGuardar({ modo: "marcacion", seccionId, turno });
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--indi)",
        backgroundImage: "var(--dots)",
        backgroundSize: "16px 16px",
      }}
    >
      <form
        onSubmit={manejarEnvio}
        style={{
          width: 400,
          background: "color-mix(in srgb, var(--white) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--white) 18%, transparent)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h1 style={{ color: "var(--white)", fontSize: 22, fontWeight: 800 }}>Configurar este kiosco</h1>
          <button
            type="button"
            onClick={cargarCatalogos}
            disabled={cargando}
            style={{ background: "none", border: "none", color: "var(--pastel)", fontSize: 12.5, fontWeight: 600 }}
          >
            {cargando ? "Cargando…" : "↻ Refrescar"}
          </button>
        </div>
        <p style={{ color: "var(--pastel)", fontSize: 13.5, marginTop: 6 }}>
          Se guarda una sola vez en este dispositivo. La lista de frentes/horarios se trae en vivo de la API, no
          queda un valor fijo desactualizado.
        </p>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ color: "#ffb4b6", fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "var(--white)", fontSize: 13 }}>Tipo de pantalla</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setModo("marcacion")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: modo === "marcacion" ? "2px solid var(--white)" : "1px solid color-mix(in srgb, var(--white) 30%, transparent)",
                  background: modo === "marcacion" ? "color-mix(in srgb, var(--white) 15%, transparent)" : "transparent",
                  color: "var(--white)",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Marcación manual
              </button>
              <button
                type="button"
                onClick={() => setModo("confirmacion")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: modo === "confirmacion" ? "2px solid var(--white)" : "1px solid color-mix(in srgb, var(--white) 30%, transparent)",
                  background: modo === "confirmacion" ? "color-mix(in srgb, var(--white) 15%, transparent)" : "transparent",
                  color: "var(--white)",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                Confirmación (lector ADMS)
              </button>
            </div>
            {modo === "confirmacion" && (
              <p style={{ color: "var(--pastel)", fontSize: 12.5, marginTop: 2, lineHeight: 1.5 }}>
                Esta pantalla no marca nada — solo muestra en vivo lo que el lector ADMS de oficina (ZKTeco MB10-VL)
                ya registró. No necesita frente ni turno (el backend los fija automáticamente para ese equipo).
              </p>
            )}
          </div>

          {modo === "marcacion" && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--white)", fontSize: 13 }}>
                Frente
            <select
              value={seccionId}
              onChange={(e) => setSeccionId(e.target.value)}
              required
              disabled={!secciones || secciones.length === 0}
              style={{ padding: "12px 14px", borderRadius: 9, border: "none", fontSize: 14 }}
            >
              {!secciones && <option value="">Cargando…</option>}
              {secciones?.length === 0 && <option value="">No hay frentes dados de alta</option>}
              {secciones?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "var(--white)", fontSize: 13 }}>
            Turno (según horario)
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              required
              disabled={!horarios || horarios.length === 0}
              style={{ padding: "12px 14px", borderRadius: 9, border: "none", fontSize: 14 }}
            >
              {!horarios && <option value="">Cargando…</option>}
              {horarios?.length === 0 && <option value="">No hay horarios dados de alta</option>}
              {horarios?.map((h) => (
                <option key={h.id} value={h.nombre}>
                  {h.nombre}
                </option>
              ))}
            </select>
          </label>
            </>
          )}

          <button
            type="submit"
            disabled={modo === "marcacion" && (!seccionId || !turno)}
            style={{
              padding: 13,
              background: "var(--indi2)",
              color: "var(--white)",
              border: "none",
              borderRadius: 9,
              fontSize: 15,
              fontWeight: 700,
              opacity: modo === "marcacion" && (!seccionId || !turno) ? 0.6 : 1,
            }}
          >
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  );
}

// Distinto de ConfigKiosco (que tiene seccionId/turno opcionales, porque el
// modo "confirmacion" no los necesita): esta pantalla solo se monta en modo
// "marcacion" (ver KioscoPage()), donde ConfigForm sí exige ambos campos
// antes de guardar — para el resto de este componente son valores reales,
// no opcionales.
interface ConfigMarcacion {
  seccionId: string;
  turno: string;
}

function PantallaKiosco({
  ahora,
  token,
  config,
  onCerrarSesion,
  onReconfigurar,
}: {
  ahora: Date;
  token: string;
  config: ConfigMarcacion;
  onCerrarSesion: () => void;
  onReconfigurar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoKiosco>("idle");
  const [modoPrueba, setModoPrueba] = useState(false);
  const [trabajadorIdPrueba, setTrabajadorIdPrueba] = useState("");
  const [mensaje, setMensaje] = useState<{ titulo: string; detalle: string; trabajadorId?: string } | null>(null);

  useEffect(() => {
    if (estado !== "success" && estado !== "error") return;
    const id = setTimeout(() => {
      setEstado("idle");
      setMensaje(null);
    }, 3500);
    return () => clearTimeout(id);
  }, [estado]);

  async function registrar(trabajadorId: string) {
    setModoPrueba(false);
    setEstado("scanning");

    // Pausa artificial: sin hardware biometrico todavia, este delay solo
    // imita el tiempo real de un escaneo para que la transicion no se sienta
    // instantanea/falsa.
    await new Promise((resolve) => setTimeout(resolve, 900));

    try {
      await registrarAsistencia(token, {
        trabajadorId,
        fecha: aFechaISO(new Date()),
        hora: aHoraHHMM(new Date()),
        seccionId: config.seccionId,
        turno: config.turno,
        metodoUsado: "huella",
      });
      setMensaje({ titulo: "¡Asistencia registrada!", detalle: "Registro exitoso", trabajadorId });
      setEstado("success");
    } catch (err) {
      const detalle = err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.";
      setMensaje({ titulo: "No se pudo registrar", detalle });
      setEstado("error");
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--indi)",
        backgroundImage: "var(--dots)",
        backgroundSize: "16px 16px",
        color: "var(--white)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(11,46,107,.35), rgba(11,46,107,.85))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "30px 44px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <img src={asset("assets/indi-logo.png")} alt="INDI" style={{ height: 34, borderRadius: 5, boxShadow: "0 6px 18px rgba(0,0,0,.25)" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 52, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {ahora.toLocaleTimeString("es-MX", { hour12: false })}
          </div>
          <div style={{ fontSize: 15, color: "var(--pastel)", marginTop: 6, textTransform: "capitalize" }}>
            {ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          textAlign: "center",
          padding: "10px 20px",
        }}
      >
        {estado === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <button
              onClick={MODO_PRUEBA_HABILITADO ? () => setModoPrueba((v) => !v) : undefined}
              disabled={!MODO_PRUEBA_HABILITADO}
              style={{
                position: "relative",
                width: 210,
                height: 210,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                padding: 0,
                cursor: MODO_PRUEBA_HABILITADO ? "pointer" : "default",
              }}
              aria-label="Registrar asistencia"
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--pastel)",
                  animation: "ringpulse 2.4s ease-out infinite",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--pastel)",
                  animation: "ringpulse 2.4s ease-out infinite 1.2s",
                }}
              />
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--white) 10%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid color-mix(in srgb, var(--white) 35%, transparent)",
                }}
              >
                <div style={{ animation: "fppulse 2.4s ease-in-out infinite" }}>{iconoHuella}</div>
              </div>
            </button>
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.01em" }}>Coloca tu dedo en el lector</h1>
              <p style={{ fontSize: 19, color: "var(--pastel)", marginTop: 10 }}>
                Toca el sensor para registrar tu asistencia
              </p>
            </div>

            {MODO_PRUEBA_HABILITADO && modoPrueba && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (trabajadorIdPrueba.trim()) registrar(trabajadorIdPrueba.trim());
                }}
                style={{
                  marginTop: -6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(0,0,0,.28)",
                  border: "1px solid color-mix(in srgb, var(--white) 20%, transparent)",
                  borderRadius: 14,
                  padding: 18,
                  width: 340,
                }}
              >
                <span style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pastel)" }}>
                  Modo de prueba — sin lector biométrico todavía
                </span>
                <input
                  type="text"
                  placeholder="ID del trabajador (UUID)"
                  value={trabajadorIdPrueba}
                  onChange={(e) => setTrabajadorIdPrueba(e.target.value)}
                  autoFocus
                  style={{ padding: "10px 12px", borderRadius: 8, border: "none", fontSize: 13.5 }}
                />
                <button
                  type="submit"
                  style={{ padding: 11, background: "var(--ok)", color: "var(--white)", border: "none", borderRadius: 8, fontWeight: 700 }}
                >
                  Simular marcación
                </button>
              </form>
            )}
          </div>
        )}

        {estado === "scanning" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <div
              style={{
                position: "relative",
                width: 170,
                height: 170,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--white) 12%, transparent)",
                border: "2px solid var(--pastel)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {iconoHuella}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 32,
                  background: "linear-gradient(180deg, transparent, color-mix(in srgb, var(--pastel) 85%, transparent), transparent)",
                  animation: "scanmove 1.6s ease-in-out infinite",
                }}
              />
            </div>
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 800 }}>Escaneando huella…</h1>
              <p style={{ fontSize: 19, color: "var(--pastel)", marginTop: 10 }}>No retires el dedo</p>
            </div>
          </div>
        )}

        {estado === "success" && mensaje && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: "50%",
                background: "var(--ok)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 12px color-mix(in srgb, var(--ok) 22%, transparent)",
                animation: "pop .45s ease-out",
              }}
            >
              <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" style={{ strokeDasharray: 180, animation: "dash .55s ease-out .1s both" }} />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--white)" }}>{mensaje.titulo}</h1>
              <p style={{ fontSize: 20, color: "var(--pastel)", marginTop: 6 }}>{mensaje.detalle}</p>
            </div>
            <div
              style={{
                background: "color-mix(in srgb, var(--white) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--white) 22%, transparent)",
                borderRadius: 16,
                padding: "22px 40px",
                display: "flex",
                gap: 44,
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--pastel)", textTransform: "uppercase" }}>
                  ID de trabajador
                </div>
                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                  {mensaje.trabajadorId}
                </div>
              </div>
              <div style={{ width: 1, height: 46, background: "color-mix(in srgb, var(--white) 25%, transparent)" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--pastel)", textTransform: "uppercase" }}>
                  Hora de entrada
                </div>
                <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 26, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {ahora.toLocaleTimeString("es-MX", { hour12: false })}
                </div>
              </div>
            </div>
          </div>
        )}

        {estado === "error" && mensaje && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: "50%",
                background: "var(--err)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 12px color-mix(in srgb, var(--err) 22%, transparent)",
                animation: "pop .4s ease-out",
              }}
            >
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth={3} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 38, fontWeight: 800 }}>{mensaje.titulo}</h1>
              <p style={{ fontSize: 20, color: "var(--pastel)", marginTop: 8 }}>{mensaje.detalle}</p>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 20px 16px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "color-mix(in srgb, var(--white) 45%, transparent)",
        }}
      >
        <button onClick={onReconfigurar} style={{ background: "none", border: "none", color: "inherit", fontSize: "inherit" }}>
          Reconfigurar frente
        </button>
        <button onClick={onCerrarSesion} style={{ background: "none", border: "none", color: "inherit", fontSize: "inherit" }}>
          Cerrar sesión del terminal
        </button>
      </div>
    </div>
  );
}

const INTERVALO_POLL_CONFIRMACION_MS = 2500;
const DURACION_ANIMACION_EXITO_MS = 4000;

function aHoraLegible(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("es-MX", { hour12: false, timeZone: "UTC" });
}

/**
 * Pantalla de confirmación del lector ADMS de oficina (ZKTeco MB10-VL):
 * nunca marca nada (a diferencia de PantallaKiosco) — solo hace polling de
 * GET /asistencias/reciente cada ~2.5s y muestra la misma animación de
 * éxito ya existente cuando detecta una marcación nueva (id distinto al
 * último visto), con el NOMBRE del trabajador en vez de su UUID (ver
 * PantallaKiosco, que sí muestra el ID — ahí tiene sentido porque viene de
 * un input manual de prueba; aquí siempre hay un Trabajador real resuelto
 * por el backend).
 */
function PantallaConfirmacion({
  ahora,
  token,
  onCerrarSesion,
  onReconfigurar,
}: {
  ahora: Date;
  token: string;
  onCerrarSesion: () => void;
  onReconfigurar: () => void;
}) {
  const [ultimaAsistencia, setUltimaAsistencia] = useState<AsistenciaListada | null>(null);
  const [mostrarExito, setMostrarExito] = useState(false);
  // undefined = todavía no se hizo el primer poll; null = se hizo, pero el
  // lector ADMS nunca ha registrado nada; string = el id de la última
  // marcación ya vista/mostrada.
  const ultimoIdVistoRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        const { asistencia } = await obtenerAsistenciaReciente(token);
        if (cancelado) return;

        // Primer poll tras montar (recién logueado/reconfigurado, o tras un
        // reinicio del equipo): solo establece la base de comparación, sin
        // disparar la animación — de lo contrario, la última marcación real
        // (aunque sea de ayer) se mostraría como "recién ocurrida" apenas
        // arranca la pantalla, que es justo lo que NO debe pasar.
        if (ultimoIdVistoRef.current === undefined) {
          ultimoIdVistoRef.current = asistencia?.id ?? null;
          return;
        }

        if (asistencia && asistencia.id !== ultimoIdVistoRef.current) {
          ultimoIdVistoRef.current = asistencia.id;
          setUltimaAsistencia(asistencia);
          setMostrarExito(true);
        }
      } catch {
        // Polling silencioso: una falla de red puntual no debe interrumpir la
        // pantalla con un mensaje de error — se reintenta sola en el
        // siguiente ciclo, sin que nadie tenga que tocar nada.
      }
    }

    verificar();
    const id = setInterval(verificar, INTERVALO_POLL_CONFIRMACION_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    if (!mostrarExito) return;
    const id = setTimeout(() => setMostrarExito(false), DURACION_ANIMACION_EXITO_MS);
    return () => clearTimeout(id);
  }, [mostrarExito]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--indi)",
        backgroundImage: "var(--dots)",
        backgroundSize: "16px 16px",
        color: "var(--white)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(11,46,107,.35), rgba(11,46,107,.85))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "30px 44px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <img src={asset("assets/indi-logo.png")} alt="INDI" style={{ height: 34, borderRadius: 5, boxShadow: "0 6px 18px rgba(0,0,0,.25)" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 52, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {ahora.toLocaleTimeString("es-MX", { hour12: false })}
          </div>
          <div style={{ fontSize: 15, color: "var(--pastel)", marginTop: 6, textTransform: "capitalize" }}>
            {ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          textAlign: "center",
          padding: "10px 20px",
        }}
      >
        {!mostrarExito && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <div
              style={{
                position: "relative",
                width: 210,
                height: 210,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--pastel)",
                  animation: "ringpulse 2.4s ease-out infinite",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--pastel)",
                  animation: "ringpulse 2.4s ease-out infinite 1.2s",
                }}
              />
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--white) 10%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid color-mix(in srgb, var(--white) 35%, transparent)",
                }}
              >
                <div style={{ animation: "fppulse 2.4s ease-in-out infinite" }}>{iconoHuella}</div>
              </div>
            </div>
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.01em" }}>Esperando marcación…</h1>
              <p style={{ fontSize: 19, color: "var(--pastel)", marginTop: 10 }}>
                El lector biométrico de oficina está conectado — no toques nada aquí
              </p>
            </div>
          </div>
        )}

        {mostrarExito && ultimaAsistencia && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: "50%",
                background: "var(--ok)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 12px color-mix(in srgb, var(--ok) 22%, transparent)",
                animation: "pop .45s ease-out",
              }}
            >
              <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" style={{ strokeDasharray: 180, animation: "dash .55s ease-out .1s both" }} />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--white)" }}>¡Bienvenido!</h1>
              <p style={{ fontSize: 20, color: "var(--pastel)", marginTop: 6 }}>Asistencia registrada</p>
            </div>
            <div
              style={{
                background: "color-mix(in srgb, var(--white) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--white) 22%, transparent)",
                borderRadius: 16,
                padding: "22px 40px",
                display: "flex",
                gap: 44,
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--pastel)", textTransform: "uppercase" }}>
                  Nombre
                </div>
                <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>{ultimaAsistencia.trabajadorNombre}</div>
              </div>
              <div style={{ width: 1, height: 46, background: "color-mix(in srgb, var(--white) 25%, transparent)" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, letterSpacing: ".14em", color: "var(--pastel)", textTransform: "uppercase" }}>
                  Hora
                </div>
                <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 26, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {aHoraLegible(ultimaAsistencia.hora)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 20px 16px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "color-mix(in srgb, var(--white) 45%, transparent)",
        }}
      >
        <button onClick={onReconfigurar} style={{ background: "none", border: "none", color: "inherit", fontSize: "inherit" }}>
          Reconfigurar pantalla
        </button>
        <button onClick={onCerrarSesion} style={{ background: "none", border: "none", color: "inherit", fontSize: "inherit" }}>
          Cerrar sesión del terminal
        </button>
      </div>
    </div>
  );
}

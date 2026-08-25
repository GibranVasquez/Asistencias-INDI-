import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import { editarObraActual, obtenerObraActual, ObraActual } from "@/core/api/resources/obras";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import { Campo, ErrorInline, estilosCampo } from "./configuracionCompartida";
import { etiquetaTimezoneObra, zonasIANAConfigurables } from "../timezoneObra";

export default function PanelDatosObra() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;
  const puedeEditar = sesion!.usuario.rol === "administrador";
  const [obra, setObra] = useState<ObraActual | null>(null);
  const [nombre, setNombre] = useState("");
  const [timezoneObra, setTimezoneObra] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerObraActual(token)
      .then((respuesta) => { setObra(respuesta.obra); setNombre(respuesta.obra.nombre); setTimezoneObra(respuesta.obra.timezoneObra); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar la obra."))
      .finally(() => setCargando(false));
  }, [token]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null); setError(null); setGuardando(true);
    try {
      const respuesta = await editarObraActual(token, nombre.trim(), timezoneObra ?? undefined);
      setObra(respuesta.obra); setNombre(respuesta.obra.nombre); setTimezoneObra(respuesta.obra.timezoneObra); setMensaje("Datos de la obra guardados.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la obra.");
    } finally { setGuardando(false); }
  }

  return (
    <section className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, maxWidth: 720 }}>
      <h2 style={{ margin: 0, fontSize: 17, color: "var(--ink)" }}>Datos de la obra</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 20px" }}>Este nombre se muestra como área o proyecto en la asistencia y sus exportaciones.</p>
      <ErrorInline mensaje={error} />
      {cargando ? <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div> : (
        <form onSubmit={guardar}>
          <Campo etiqueta="Área / proyecto">
            <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} disabled={!puedeEditar || guardando} maxLength={200} style={{ ...estilosCampo, width: "100%", boxSizing: "border-box" }} />
          </Campo>
          <Campo etiqueta="Zona horaria de la obra">
            <select value={timezoneObra ?? ""} onChange={(evento) => setTimezoneObra(evento.target.value || null)} disabled={!puedeEditar || guardando} style={{ ...estilosCampo, width: "100%", boxSizing: "border-box" }}>
              <option value="">{timezoneObra ? "Selecciona una zona IANA" : etiquetaTimezoneObra(timezoneObra)}</option>
              {timezoneObra && <option value={timezoneObra}>{timezoneObra}</option>}
              {zonasIANAConfigurables().filter((zona) => zona !== timezoneObra).map((zona) => <option key={zona} value={zona}>{zona}</option>)}
            </select>
          </Campo>
          {!puedeEditar && <p style={{ color: "var(--muted)", fontSize: 12.5 }}>Solo un Administrador puede modificar este dato.</p>}
          {mensaje && <p style={{ color: "var(--ok, #18794e)", fontSize: 13 }}>{mensaje}</p>}
          {puedeEditar && <Boton type="submit" disabled={guardando || !nombre.trim() || (nombre.trim() === obra?.nombre && timezoneObra === obra?.timezoneObra)}>{guardando ? "Guardando…" : "Guardar cambios"}</Boton>}
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/core/api/client";
import { crearTarifaHoraExtra, DatosTarifaHoraExtra, listarTarifasHoraExtra, TarifaHoraExtra } from "@/core/api/resources/tarifasHoraExtra";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import Boton from "@/shared/components/Boton";
import CampoFecha from "@/shared/components/CampoFecha";
import { BotonesModal, Campo, ErrorInline, estilosCampo, Modal } from "./configuracionCompartida";

function hoyISO(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

export default function PanelTarifas() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;

  const [tarifas, setTarifas] = useState<TarifaHoraExtra[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [formulario, setFormulario] = useState<DatosTarifaHoraExtra>({ valor: 0, vigenteDesde: hoyISO() });
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cargar() {
    setCargando(true);
    setError(null);
    listarTarifasHoraExtra(token)
      .then((r) => setTarifas(r.tarifas))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }
  useEffect(cargar, [token]);

  // La vigente es la de vigenteDesde más reciente que ya haya empezado
  // (<=hoy) — misma regla que calcularMontoHorasExtra en el backend.
  const idVigente = (() => {
    if (!tarifas) return null;
    const hoy = hoyISO();
    const candidatas = tarifas.filter((t) => t.vigenteDesde.slice(0, 10) <= hoy);
    if (candidatas.length === 0) return null;
    return candidatas.reduce((a, b) => (a.vigenteDesde > b.vigenteDesde ? a : b)).id;
  })();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorModal(null);
    setGuardando(true);
    try {
      await crearTarifaHoraExtra(token, formulario);
      setModal(false);
      setFormulario({ valor: 0, vigenteDesde: hoyISO() });
      cargar();
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(46,99,199,.1)", color: "var(--indi2)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
        Esto es un historial (append-only), no un valor único que se edita. Cada alta agrega una tarifa nueva vigente desde una fecha;
        una tarifa ya usada en una nómina generada no se puede editar ni borrar.
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{tarifas ? `${tarifas.length} tarifa${tarifas.length === 1 ? "" : "s"} en el historial` : "Cargando…"}</span>
          <Boton
            tamano="pequeno"
            onClick={() => {
              setFormulario({ valor: 0, vigenteDesde: hoyISO() });
              setErrorModal(null);
              setModal(true);
            }}
          >
            + Nueva tarifa
          </Boton>
        </div>

        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : tarifas?.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Sin tarifas registradas todavía.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "10px 20px" }}>Valor por hora</th>
                <th style={{ padding: "10px 12px" }}>Vigente desde</th>
                <th style={{ padding: "10px 20px" }}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {tarifas?.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
                  <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>${Number(t.valor).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.vigenteDesde.slice(0, 10)}</td>
                  <td style={{ padding: "11px 20px" }}>
                    {t.id === idVigente ? (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ok)", background: "rgba(47,174,102,.12)", padding: "3px 10px", borderRadius: 999 }}>Vigente actualmente</span>
                    ) : (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", background: "var(--pastel)", padding: "3px 10px", borderRadius: 999 }}>Histórica</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal onClose={() => setModal(false)}>
          <form onSubmit={enviar}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>Nueva tarifa de hora extra</h2>
            <ErrorInline mensaje={errorModal} />
            <Campo etiqueta="Valor por hora">
              <input type="number" min={0.01} step="0.01" required value={formulario.valor} onChange={(e) => setFormulario((f) => ({ ...f, valor: Number(e.target.value) }))} style={estilosCampo} />
            </Campo>
            <Campo etiqueta="Vigente desde">
              <CampoFecha required value={formulario.vigenteDesde} onChange={(e) => setFormulario((f) => ({ ...f, vigenteDesde: e.target.value }))} />
            </Campo>
            <BotonesModal guardando={guardando} onCancelar={() => setModal(false)} etiqueta="Crear tarifa" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Categorías de trabajador
// ---------------------------------------------------------------------

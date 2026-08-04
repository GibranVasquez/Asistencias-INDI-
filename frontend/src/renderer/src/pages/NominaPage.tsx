import { useEffect, useMemo, useState } from "react";
import {
  CamposEditablesNomina,
  corregirNomina,
  generarNomina,
  NominaEstatus,
  obtenerVistaPreviaNomina,
  VistaPreviaTrabajador,
} from "../api/nominas";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import TarjetaKPI from "../components/TarjetaKPI";
import Boton from "../components/Boton";
import CampoFecha from "../components/CampoFecha";

const CONCURRENCIA_GENERACION = 6;

function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function lunesDeSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  copia.setDate(copia.getDate() + diff);
  return copia;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function numeroSeguro(valor: string): number {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function edicionVacia(): CamposEditablesNomina {
  return { horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0, aguinaldo: null };
}

function edicionDesdeExistente(t: VistaPreviaTrabajador): CamposEditablesNomina {
  if (!t.nominaExistente) return edicionVacia();
  return {
    horasExtra: Number(t.nominaExistente.horasExtra),
    viaticosSemanal: Number(t.nominaExistente.viaticosSemanal),
    viaticosMensual: Number(t.nominaExistente.viaticosMensual),
    descuentosVarios: Number(t.nominaExistente.descuentosVarios),
    aguinaldo: t.nominaExistente.aguinaldo !== null ? Number(t.nominaExistente.aguinaldo) : null,
  };
}

type ResultadoFila = { ok: true; mensaje: string } | { ok: false; mensaje: string };

type FiltroEstatus = "todos" | "sin_generar" | NominaEstatus;

const ETIQUETA_ESTATUS: Record<NominaEstatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  con_incidencia: "Con incidencia",
};

// Corre `tareas` con un tope de concurrencia (en vez de 137 fetch simultáneos
// o uno por uno) — más rápido que secuencial, sin depender de que el
// limitador global (500/15min) absorba un pico de 137 requests instantáneos.
async function conConcurrenciaLimitada<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function trabajador(): Promise<void> {
    while (cursor < items.length) {
      const indice = cursor++;
      await tarea(items[indice]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
}

export default function NominaPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [inicioSemana, setInicioSemana] = useState(() => lunesDeSemana(new Date()));
  const periodoInicio = aFechaISO(inicioSemana);
  const periodoFin = aFechaISO(sumarDias(inicioSemana, 6));

  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaTrabajador[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ediciones, setEdiciones] = useState<Record<string, CamposEditablesNomina>>({});
  const [resultados, setResultados] = useState<Record<string, ResultadoFila>>({});
  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const [busqueda, setBusqueda] = useState("");
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [estatusFiltro, setEstatusFiltro] = useState<FiltroEstatus>("todos");

  function cargarVistaPrevia() {
    setCargando(true);
    setError(null);
    setResultados({});
    obtenerVistaPreviaNomina(token, periodoInicio, periodoFin)
      .then((r) => {
        setVistaPrevia(r.trabajadores);
        const nuevasEdiciones: Record<string, CamposEditablesNomina> = {};
        r.trabajadores.forEach((t) => {
          nuevasEdiciones[t.id] = edicionDesdeExistente(t);
        });
        setEdiciones(nuevasEdiciones);
      })
      .catch((err) => {
        const mensaje =
          err instanceof ApiError
            ? err.status === 403
              ? "no disponible para tu rol"
              : err.message
            : "No se pudo conectar con el servidor.";
        setError(mensaje);
        setVistaPrevia(null);
      })
      .finally(() => setCargando(false));
  }

  useEffect(cargarVistaPrevia, [token, periodoInicio, periodoFin]);

  function actualizarCampo(trabajadorId: string, campo: keyof CamposEditablesNomina, valor: string) {
    setEdiciones((prev) => ({
      ...prev,
      [trabajadorId]: {
        ...prev[trabajadorId],
        [campo]: campo === "aguinaldo" && valor === "" ? null : numeroSeguro(valor),
      },
    }));
  }

  const seccionesDisponibles = useMemo(() => {
    const set = new Set<string>();
    vistaPrevia?.forEach((t) => t.seccionesTrabajadas.forEach((s) => set.add(s)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [vistaPrevia]);

  function estatusDeFila(t: VistaPreviaTrabajador): FiltroEstatus {
    return t.nominaExistente ? t.nominaExistente.estatus : "sin_generar";
  }

  const filtrados = useMemo(() => {
    if (!vistaPrevia) return [];
    const q = busqueda.trim().toLowerCase();
    return vistaPrevia.filter((t) => {
      if (q && !t.nombreCompleto.toLowerCase().includes(q)) return false;
      if (seccionFiltro && !t.seccionesTrabajadas.includes(seccionFiltro)) return false;
      if (estatusFiltro !== "todos" && estatusDeFila(t) !== estatusFiltro) return false;
      return true;
    });
  }, [vistaPrevia, busqueda, seccionFiltro, estatusFiltro]);

  const incompletos = vistaPrevia?.filter((t) => t.datosIncompletos).length ?? 0;
  const procesables = vistaPrevia?.filter((t) => !t.datosIncompletos).length ?? 0;

  const kpis = useMemo(() => {
    let totalNomina = 0;
    let horasExtraPagadas = 0;
    let infonavitTotal = 0;
    let descuentosTotal = 0;
    vistaPrevia?.forEach((t) => {
      if (!t.nominaExistente) return;
      totalNomina += Number(t.nominaExistente.totalAPagar);
      horasExtraPagadas += Number(t.nominaExistente.montoHorasExtra);
      infonavitTotal += Number(t.nominaExistente.infonavitDescuento);
      descuentosTotal += Number(t.nominaExistente.descuentosVarios);
    });
    return { totalNomina, horasExtraPagadas, infonavitTotal, descuentosTotal };
  }, [vistaPrevia]);

  const generadas = vistaPrevia?.filter((t) => t.nominaExistente).length ?? 0;

  async function calcularNominaDeLaSemana() {
    if (!vistaPrevia) return;
    const candidatas = vistaPrevia.filter((t) => !t.datosIncompletos);
    setGenerando(true);
    setProgreso(0);
    setResultados({});

    let completadas = 0;
    const nuevosResultados: Record<string, ResultadoFila> = {};

    await conConcurrenciaLimitada(candidatas, CONCURRENCIA_GENERACION, async (t) => {
      const datos = ediciones[t.id] ?? edicionVacia();
      try {
        if (t.nominaExistente) {
          await corregirNomina(token, t.nominaExistente.id, datos);
          nuevosResultados[t.id] = { ok: true, mensaje: "Corregida" };
        } else {
          await generarNomina(token, t.id, periodoInicio, periodoFin, datos);
          nuevosResultados[t.id] = { ok: true, mensaje: "Generada" };
        }
      } catch (err) {
        nuevosResultados[t.id] = {
          ok: false,
          mensaje: err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.",
        };
      }
      completadas++;
      setProgreso(completadas);
    });

    setResultados(nuevosResultados);
    setGenerando(false);

    // Refresca desde el backend para que KPIs/estatus/totales reflejen lo
    // recién calculado — nuevosResultados se conserva por separado para
    // seguir mostrando el resultado por fila de esta corrida.
    obtenerVistaPreviaNomina(token, periodoInicio, periodoFin).then((r) => {
      setVistaPrevia(r.trabajadores);
      const nuevasEdiciones: Record<string, CamposEditablesNomina> = {};
      r.trabajadores.forEach((t) => {
        nuevasEdiciones[t.id] = edicionDesdeExistente(t);
      });
      setEdiciones(nuevasEdiciones);
    });
  }

  function exportarCSV() {
    const encabezados = [
      "Nombre",
      "Categoría",
      "Secciones trabajadas",
      "Días laborados",
      "Horas extra",
      "Viáticos semanal",
      "Viáticos mensual",
      "Descuentos varios",
      "Aguinaldo",
      "Total a pagar",
      "Estatus",
    ];
    const filas = filtrados.map((t) => {
      const e = ediciones[t.id] ?? edicionVacia();
      const estatus = t.nominaExistente ? ETIQUETA_ESTATUS[t.nominaExistente.estatus] : "Sin generar";
      return [
        t.nombreCompleto,
        t.categoria,
        t.seccionesTrabajadas.join(" / "),
        String(t.diasLaborados),
        String(e.horasExtra),
        String(e.viaticosSemanal),
        String(e.viaticosMensual),
        String(e.descuentosVarios),
        e.aguinaldo !== null ? String(e.aguinaldo) : "",
        t.nominaExistente?.totalAPagar ?? "",
        estatus,
      ];
    });
    const csv = [encabezados, ...filas]
      .map((fila) => fila.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomina_${periodoInicio}_${periodoFin}.csv`;
    a.click();
    // Revocar en el mismo tick destruye el blob antes de que el navegador
    // termine de procesar la descarga (asíncrono) — falla en silencio.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const estilosCampo = { padding: "9px 10px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" };

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <style>{`@media print {
        .no-imprimir { display: none !important; }
        table { font-size: 11px; }
      }`}</style>

      <div className="no-imprimir" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Nómina RH</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            Captura masiva semanal · {periodoInicio} — {periodoFin}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Boton variante="outline" tamano="pequeno" onClick={() => setInicioSemana((f) => sumarDias(f, -7))}>
            ← Semana anterior
          </Boton>
          <CampoFecha
            value={periodoInicio}
            onChange={(e) => setInicioSemana(lunesDeSemana(new Date(`${e.target.value}T00:00:00`)))}
          />
          <Boton variante="outline" tamano="pequeno" onClick={() => setInicioSemana((f) => sumarDias(f, 7))}>
            Semana siguiente →
          </Boton>
        </div>
      </div>

      <div className="no-imprimir" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 22 }}>
        <TarjetaKPI color="var(--indi2)" fondo="rgba(46,99,199,.12)" etiqueta="Total nómina semanal" valor={`$${kpis.totalNomina.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} nota={`${generadas} de ${vistaPrevia?.length ?? 0} generadas`} />
        <TarjetaKPI color="var(--indi)" fondo="rgba(122,92,224,.12)" etiqueta="Horas extra pagadas" valor={`$${kpis.horasExtraPagadas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
        <TarjetaKPI color="var(--warn)" fondo="color-mix(in srgb, var(--warn) 14%, transparent)" etiqueta="Retención INFONAVIT" valor={`$${kpis.infonavitTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
        <TarjetaKPI color="var(--err)" fondo="color-mix(in srgb, var(--err) 12%, transparent)" etiqueta="Descuentos varios" valor={`$${kpis.descuentosTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
      </div>

      {incompletos > 0 && (
        <div className="no-imprimir" style={{ marginTop: 14, padding: "10px 16px", borderRadius: 10, background: "color-mix(in srgb, var(--warn) 14%, transparent)", color: "var(--warn)", fontSize: 13, fontWeight: 600 }}>
          {incompletos} trabajador{incompletos === 1 ? "" : "es"} no se puede{incompletos === 1 ? "" : "n"} procesar por datos incompletos (excluido{incompletos === 1 ? "" : "s"} de la generación masiva).
        </div>
      )}

      <div className="no-imprimir" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Buscar trabajador
          <input type="text" placeholder="Nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilosCampo} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Sección
          <select value={seccionFiltro} onChange={(e) => setSeccionFiltro(e.target.value)} style={{ ...estilosCampo, minWidth: 160 }}>
            <option value="">Todas</option>
            {seccionesDisponibles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
          Estatus
          <select value={estatusFiltro} onChange={(e) => setEstatusFiltro(e.target.value as FiltroEstatus)} style={{ ...estilosCampo, minWidth: 160 }}>
            <option value="todos">Todos</option>
            <option value="sin_generar">Sin generar</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="con_incidencia">Con incidencia</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <Boton variante="outline" onClick={exportarCSV} disabled={!vistaPrevia}>
            Exportar CSV (Excel)
          </Boton>
          <Boton variante="outline" onClick={() => window.print()} disabled={!vistaPrevia}>
            Exportar PDF
          </Boton>
          <Boton onClick={calcularNominaDeLaSemana} disabled={generando || !vistaPrevia || procesables === 0}>
            {generando ? `Calculando… ${progreso}/${procesables}` : `Calcular nómina de la semana (${procesables})`}
          </Boton>
        </div>
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Sin resultados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 16px" }}>Trabajador</th>
                  <th style={{ padding: "10px 10px" }}>Categoría</th>
                  <th style={{ padding: "10px 10px" }}>Sección(es)</th>
                  <th style={{ padding: "10px 10px" }}>Días</th>
                  <th style={{ padding: "10px 10px" }}>Hrs. extra</th>
                  <th style={{ padding: "10px 10px" }}>Viát. semanal</th>
                  <th style={{ padding: "10px 10px" }}>Viát. mensual</th>
                  <th style={{ padding: "10px 10px" }}>Descuentos</th>
                  <th style={{ padding: "10px 10px" }}>Aguinaldo</th>
                  <th style={{ padding: "10px 10px" }}>Total</th>
                  <th style={{ padding: "10px 10px" }}>Estatus</th>
                  <th className="no-imprimir" style={{ padding: "10px 16px" }}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => {
                  const e = ediciones[t.id] ?? edicionVacia();
                  const resultado = resultados[t.id];
                  const bloqueada = t.datosIncompletos;
                  return (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--line)", fontSize: 13, opacity: bloqueada ? 0.5 : 1 }}>
                      <td style={{ padding: "9px 16px", fontWeight: 600, color: "var(--ink)" }}>{t.nombreCompleto}</td>
                      <td style={{ padding: "9px 10px", color: "var(--muted)" }}>{t.categoria}</td>
                      <td style={{ padding: "9px 10px", color: "var(--muted)" }}>
                        {t.seccionesTrabajadas.length > 0 ? t.seccionesTrabajadas.join(", ") : "—"}
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{t.diasLaborados}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <input type="number" min={0} step="0.5" disabled={bloqueada} value={e.horasExtra} onChange={(ev) => actualizarCampo(t.id, "horasExtra", ev.target.value)} style={{ ...estilosCampo, width: 70, padding: "6px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input type="number" min={0} step="0.01" disabled={bloqueada} value={e.viaticosSemanal} onChange={(ev) => actualizarCampo(t.id, "viaticosSemanal", ev.target.value)} style={{ ...estilosCampo, width: 80, padding: "6px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input type="number" min={0} step="0.01" disabled={bloqueada} value={e.viaticosMensual} onChange={(ev) => actualizarCampo(t.id, "viaticosMensual", ev.target.value)} style={{ ...estilosCampo, width: 80, padding: "6px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input type="number" min={0} step="0.01" disabled={bloqueada} value={e.descuentosVarios} onChange={(ev) => actualizarCampo(t.id, "descuentosVarios", ev.target.value)} style={{ ...estilosCampo, width: 80, padding: "6px 8px" }} />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input type="number" min={0} step="0.01" disabled={bloqueada} value={e.aguinaldo ?? ""} placeholder="—" onChange={(ev) => actualizarCampo(t.id, "aguinaldo", ev.target.value)} style={{ ...estilosCampo, width: 80, padding: "6px 8px" }} />
                      </td>
                      <td style={{ padding: "9px 10px", color: "var(--ink)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {bloqueada ? (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 14%, transparent)", padding: "3px 10px", borderRadius: 999 }}>Incompleta</span>
                        ) : t.nominaExistente ? (
                          `$${Number(t.nominaExistente.totalAPagar).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        {!bloqueada && (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: !t.nominaExistente ? "var(--muted)" : t.nominaExistente.estatus === "pagado" ? "var(--ok)" : t.nominaExistente.estatus === "con_incidencia" ? "var(--err)" : "var(--warn)",
                              background: !t.nominaExistente
                                ? "var(--pastel)"
                                : t.nominaExistente.estatus === "pagado"
                                ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                                : t.nominaExistente.estatus === "con_incidencia"
                                ? "color-mix(in srgb, var(--err) 12%, transparent)"
                                : "color-mix(in srgb, var(--warn) 14%, transparent)",
                              padding: "3px 10px",
                              borderRadius: 999,
                            }}
                          >
                            {t.nominaExistente ? ETIQUETA_ESTATUS[t.nominaExistente.estatus] : "Sin generar"}
                          </span>
                        )}
                      </td>
                      <td className="no-imprimir" style={{ padding: "9px 16px" }}>
                        {resultado && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: resultado.ok ? "var(--ok)" : "var(--err)" }}>
                            {resultado.ok ? "✓ " : "✗ "}
                            {resultado.mensaje}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { AsistenciaListada, listarAsistencias } from "../api/asistencias";
import { ApiError } from "../api/client";
import { Horario, listarHorarios } from "../api/horarios";
import { listarSecciones, Seccion } from "../api/secciones";
import { listarTerminales, Terminal } from "../api/terminales";
import { listarTrabajadores, Trabajador } from "../api/trabajadores";
import { useAuth } from "../context/AuthContext";

type Rango = "dia" | "semana" | "mes";

// Umbral fijo, no ligado a horario de oficina real (no hay uno modelado de
// forma reutilizable para este propósito) — 24h cubre "no sincronizó desde
// ayer" sin necesitar saber turnos exactos. Solo aplica a terminales
// tipo="adms": son los únicos donde ultimaSincronizacion se actualiza (el
// Kiosco Electron no tiene ese campo poblado — no hace falta, tiene su
// propia sesión JWT). Con IP dejando de ser la mitigación real del endpoint
// ADMS (ver restringirPorIP.ts), esta alerta es la forma de enterarse rápido
// si algo se rompió (IP, proveedor, o el equipo mismo) en vez de descubrirlo
// días después al ver nómina rara.
const UMBRAL_HORAS_INACTIVIDAD_ADMS = 24;

function terminalAdmsInactivo(terminal: Terminal, ahora: Date): boolean {
  if (terminal.tipo !== "adms") return false;
  if (!terminal.ultimaSincronizacion) return true;
  const horasDesdeUltimaSync = (ahora.getTime() - new Date(terminal.ultimaSincronizacion).getTime()) / 3_600_000;
  return horasDesdeUltimaSync > UMBRAL_HORAS_INACTIVIDAD_ADMS;
}

const NOMBRES_DIA_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function aFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  const dia = copia.getDay();
  const diff = dia === 0 ? -6 : 1 - dia; // retrocede al lunes
  copia.setDate(copia.getDate() + diff);
  return copia;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

// Rango de fechas a consultar segun el periodo elegido. fin nunca pasa de
// "hoy" (no tiene sentido pedirle a la API datos futuros).
function rangoConsulta(rango: Rango, hoy: Date): { inicio: Date; fin: Date } {
  if (rango === "dia") return { inicio: hoy, fin: hoy };
  if (rango === "semana") return { inicio: inicioDeSemana(hoy), fin: hoy };
  return { inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1), fin: hoy };
}

// Compara la hora marcada contra el horario esperado de la SECCION en la
// que se marco esa asistencia (Seccion.horarioId, resuelto via
// resolverHorario). Reemplaza el atajo anterior de "un horario unico para
// toda la obra" — decision del usuario 2026-07-21 confirmada: oficina y
// campo tienen horarios/tolerancias distintos de verdad.
function llegoATiempo(horaISO: string, horario: Horario): boolean {
  const marcada = new Date(horaISO).getTime();
  const entrada = new Date(horario.horaEntrada).getTime();
  const limite = entrada + horario.toleranciaMinutos * 60_000;
  return marcada <= limite;
}

interface EstadoCarga<T> {
  datos: T | null;
  error: string | null;
  cargando: boolean;
}

function useCargaProtegida<T>(cargar: () => Promise<T>, deps: unknown[]): EstadoCarga<T> {
  const [estado, setEstado] = useState<EstadoCarga<T>>({ datos: null, error: null, cargando: true });

  useEffect(() => {
    let cancelado = false;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    cargar()
      .then((datos) => {
        if (!cancelado) setEstado({ datos, error: null, cargando: false });
      })
      .catch((err) => {
        if (cancelado) return;
        const mensaje =
          err instanceof ApiError
            ? err.status === 403
              ? "no disponible para tu rol"
              : err.message
            : "no se pudo conectar con el servidor";
        setEstado({ datos: null, error: mensaje, cargando: false });
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return estado;
}

export default function DashboardPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;

  const [rango, setRango] = useState<Rango>("semana");
  const hoy = useMemo(() => new Date(), []);
  const hoyISO = aFechaISO(hoy);
  const { inicio, fin } = useMemo(() => rangoConsulta(rango, hoy), [rango, hoy]);

  const asistenciasHoy = useCargaProtegida(
    () => listarAsistencias(token, { fecha: hoyISO }).then((r) => r.asistencias),
    [token, hoyISO]
  );
  const asistenciasPeriodo = useCargaProtegida(
    () =>
      listarAsistencias(token, { fechaInicio: aFechaISO(inicio), fechaFin: aFechaISO(fin) }).then(
        (r) => r.asistencias
      ),
    [token, aFechaISO(inicio), aFechaISO(fin)]
  );
  const trabajadores = useCargaProtegida(() => listarTrabajadores(token).then((r) => r.trabajadores), [token]);
  const secciones = useCargaProtegida(() => listarSecciones(token).then((r) => r.secciones), [token]);
  const horarios = useCargaProtegida(() => listarHorarios(token).then((r) => r.horarios), [token]);
  const terminales = useCargaProtegida(() => listarTerminales(token).then((r) => r.terminales), [token]);

  const terminalesAdmsInactivos = useMemo(
    () => (terminales.datos ?? []).filter((t) => terminalAdmsInactivo(t, hoy)),
    [terminales.datos, hoy]
  );

  // Puntualidad depende de las dos listas: cuál horario le toca a una
  // seccion (secciones) y los datos de ese horario (horarios). Si CUALQUIERA
  // de las dos no está disponible para el rol actual, no se puede resolver.
  const cargandoPuntualidad = secciones.cargando || horarios.cargando;
  const errorPuntualidad = secciones.error ?? horarios.error;

  const mapaTrabajadores = useMemo(() => {
    const mapa = new Map<string, Trabajador>();
    trabajadores.datos?.forEach((t) => mapa.set(t.id, t));
    return mapa;
  }, [trabajadores.datos]);

  const mapaHorarios = useMemo(() => {
    const mapa = new Map<string, Horario>();
    horarios.datos?.forEach((h) => mapa.set(h.id, h));
    return mapa;
  }, [horarios.datos]);

  const mapaSecciones = useMemo(() => {
    const mapa = new Map<string, Seccion>();
    secciones.datos?.forEach((s) => mapa.set(s.id, s));
    return mapa;
  }, [secciones.datos]);

  function resolverHorario(seccionId: string): Horario | null {
    const horarioId = mapaSecciones.get(seccionId)?.horarioId;
    if (!horarioId) return null;
    return mapaHorarios.get(horarioId) ?? null;
  }

  const totalActivos = useMemo(
    () => trabajadores.datos?.filter((t) => t.estatus === "activo").length ?? null,
    [trabajadores.datos]
  );

  const idsPresentesHoy = useMemo(
    () => new Set((asistenciasHoy.datos ?? []).map((a) => a.trabajadorId)),
    [asistenciasHoy.datos]
  );
  const ausentesHoy = totalActivos !== null ? totalActivos - idsPresentesHoy.size : null;

  const { aTiempo, tarde } = useMemo(() => {
    if (cargandoPuntualidad || errorPuntualidad || !asistenciasPeriodo.datos) {
      return { aTiempo: null as number | null, tarde: null as number | null };
    }
    let aTiempoN = 0;
    let tardeN = 0;
    for (const a of asistenciasPeriodo.datos) {
      const horarioSeccion = resolverHorario(a.seccionId);
      // Sin horario asignado a esa seccion todavia: no se puede clasificar
      // (no cuenta ni como a tiempo ni como tardanza), pero SI sigue
      // contando en "Asistencias" — nunca se descarta un registro real.
      if (!horarioSeccion) continue;
      if (llegoATiempo(a.hora, horarioSeccion)) aTiempoN++;
      else tardeN++;
    }
    return { aTiempo: aTiempoN, tarde: tardeN };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asistenciasPeriodo.datos, cargandoPuntualidad, errorPuntualidad, mapaSecciones, mapaHorarios]);

  const totalPeriodo = asistenciasPeriodo.datos?.length ?? null;
  const porcentajeATiempo = aTiempo !== null && totalPeriodo ? Math.round((aTiempo / totalPeriodo) * 100) : null;

  const barras = useMemo(() => {
    if (!asistenciasPeriodo.datos) return [];
    if (rango === "mes") return bucketsPorSemanaDelMes(asistenciasPeriodo.datos, inicio, hoy);
    return bucketsPorDia(asistenciasPeriodo.datos, inicio, rango === "dia" ? hoy : sumarDias(inicioDeSemana(hoy), 4));
  }, [asistenciasPeriodo.datos, rango, inicio, hoy]);

  const ultimasMarcaciones = useMemo(
    () =>
      [...(asistenciasHoy.datos ?? [])]
        .sort((a, b) => new Date(b.hora).getTime() - new Date(a.hora).getTime())
        .slice(0, 6),
    [asistenciasHoy.datos]
  );

  const etiquetaPeriodo = rango === "dia" ? "hoy" : rango === "semana" ? "esta semana" : "este mes";

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4, textTransform: "capitalize" }}>
            {hoy.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 4 }}>
          {(["dia", "semana", "mes"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRango(r)}
              style={{
                padding: "8px 18px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                background: rango === r ? "var(--indi)" : "transparent",
                color: rango === r ? "#fff" : "var(--muted)",
              }}
            >
              {r === "dia" ? "Día" : r === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {terminalesAdmsInactivos.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "rgba(229,72,77,.1)",
            border: "1px solid var(--err)",
            borderRadius: 12,
            padding: "14px 18px",
            marginTop: 22,
          }}
        >
          {terminalesAdmsInactivos.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
              <span style={{ fontWeight: 700, color: "var(--err)" }}>⚠</span>
              <span>
                El terminal de oficina <strong>"{t.ubicacion}"</strong> no ha sincronizado
                {t.ultimaSincronizacion
                  ? ` desde hace más de ${UMBRAL_HORAS_INACTIVIDAD_ADMS} horas (última vez: ${new Date(
                      t.ultimaSincronizacion
                    ).toLocaleString("es-MX")}).`
                  : " nunca."}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 22 }}>
        <TarjetaKPI
          color="var(--indi2)"
          fondo="rgba(46,99,199,.12)"
          etiqueta={`Asistencias ${etiquetaPeriodo}`}
          valor={totalPeriodo === null ? asistenciasPeriodo.error ?? "…" : totalPeriodo}
        />
        <TarjetaKPI
          color="var(--ok)"
          fondo="rgba(47,174,102,.12)"
          etiqueta="Puntualidad"
          valor={porcentajeATiempo === null ? errorPuntualidad ?? asistenciasPeriodo.error ?? "…" : `${porcentajeATiempo}%`}
        />
        <TarjetaKPI
          color="var(--warn)"
          fondo="rgba(242,169,59,.14)"
          etiqueta="Tardanzas"
          valor={tarde === null ? errorPuntualidad ?? asistenciasPeriodo.error ?? "…" : tarde}
        />
        <TarjetaKPI
          color="var(--err)"
          fondo="rgba(229,72,77,.12)"
          etiqueta="Ausentes hoy"
          valor={ausentesHoy === null ? trabajadores.error ?? "…" : ausentesHoy}
          nota={totalActivos !== null ? `de ${totalActivos} trabajadores activos` : undefined}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Asistencia por día</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {rango === "dia" ? "Hoy" : rango === "semana" ? "Semana actual" : "Mes actual"}
            </span>
          </div>
          {asistenciasPeriodo.cargando ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
          ) : (
            <GraficaBarras barras={barras} />
          )}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", alignSelf: "flex-start" }}>Puntualidad</h3>
          <DonaPuntualidad aTiempo={aTiempo} tarde={tarde} error={errorPuntualidad ?? asistenciasPeriodo.error} />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Últimas marcaciones de hoy</h3>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            {ultimasMarcaciones.length} registro{ultimasMarcaciones.length === 1 ? "" : "s"}
          </span>
        </div>
        {asistenciasHoy.cargando ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
        ) : ultimasMarcaciones.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Sin marcaciones registradas hoy todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ultimasMarcaciones.map((a, i) => {
              const trabajador = mapaTrabajadores.get(a.trabajadorId);
              const nombre = trabajador?.nombreCompleto ?? `ID ${a.trabajadorId.slice(0, 8)}…`;
              const iniciales = trabajador
                ? trabajador.nombreCompleto
                    .split(" ")
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()
                : "—";
              const horarioSeccion = resolverHorario(a.seccionId);
              const puntual = horarioSeccion ? llegoATiempo(a.hora, horarioSeccion) : null;
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 0",
                    borderBottom: i === ultimasMarcaciones.length - 1 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--pastel)",
                        color: "var(--indi)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {iniciales}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{nombre}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 13, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(a.hora).toISOString().slice(11, 16)}
                    </span>
                    {puntual !== null && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: puntual ? "var(--ok)" : "var(--warn)",
                          background: puntual ? "rgba(47,174,102,.12)" : "rgba(242,169,59,.14)",
                          padding: "3px 10px",
                          borderRadius: 999,
                        }}
                      >
                        {puntual ? "A tiempo" : "Tardanza"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function bucketsPorDia(asistencias: AsistenciaListada[], inicio: Date, fin: Date): { etiqueta: string; valor: number; esFuturo: boolean }[] {
  const conteos = new Map<string, number>();
  for (const a of asistencias) {
    const clave = a.fecha.slice(0, 10);
    conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
  }
  const dias: { etiqueta: string; valor: number; esFuturo: boolean }[] = [];
  const hoy = aFechaISO(new Date());
  for (let cursor = new Date(inicio); cursor <= fin; cursor = sumarDias(cursor, 1)) {
    const clave = aFechaISO(cursor);
    dias.push({
      etiqueta: NOMBRES_DIA_CORTOS[cursor.getDay()],
      valor: conteos.get(clave) ?? 0,
      esFuturo: clave > hoy,
    });
  }
  return dias;
}

function bucketsPorSemanaDelMes(asistencias: AsistenciaListada[], inicioMes: Date, hoy: Date): { etiqueta: string; valor: number; esFuturo: boolean }[] {
  const conteos: number[] = [];
  const hoyISO = aFechaISO(hoy);
  let cursor = new Date(inicioMes);
  let numeroSemana = 1;
  while (cursor.getMonth() === inicioMes.getMonth()) {
    const finSemana = sumarDias(cursor, 6);
    let cuenta = 0;
    let futura = true;
    for (const a of asistencias) {
      const claveA = a.fecha.slice(0, 10);
      if (claveA >= aFechaISO(cursor) && claveA <= aFechaISO(finSemana)) cuenta++;
    }
    futura = aFechaISO(cursor) > hoyISO;
    conteos.push(cuenta);
    cursor = sumarDias(finSemana, 1);
    numeroSemana++;
  }
  return conteos.map((valor, i) => ({ etiqueta: `Sem ${i + 1}`, valor, esFuturo: false }));
}

function TarjetaKPI({
  color,
  fondo,
  etiqueta,
  valor,
  nota,
}: {
  color: string;
  fondo: string;
  etiqueta: string;
  valor: number | string;
  nota?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: fondo, border: `2px solid ${color}` }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>{etiqueta}</span>
      </div>
      <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: typeof valor === "string" && valor.length > 4 ? 16 : 36, marginTop: 12, color: "var(--ink)" }}>
        {valor}
      </div>
      {nota && <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>{nota}</div>}
    </div>
  );
}

function GraficaBarras({ barras }: { barras: { etiqueta: string; valor: number; esFuturo: boolean }[] }) {
  if (barras.length === 0) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin datos en este periodo.</div>;
  }
  const max = Math.max(...barras.map((b) => b.valor), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 190, marginTop: 20, paddingBottom: 26, position: "relative" }}>
      {barras.map((b, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: b.esFuturo ? "var(--muted)" : "var(--indi)" }}>
            {b.esFuturo ? "—" : b.valor}
          </span>
          <div
            style={{
              width: "100%",
              maxWidth: 46,
              height: `${Math.max((b.valor / max) * 100, 3)}%`,
              background: b.esFuturo ? "var(--pastel)" : "linear-gradient(180deg,var(--indi2),var(--indi))",
              borderRadius: "7px 7px 0 0",
            }}
          />
          <span style={{ position: "absolute", bottom: 0, fontSize: 12, color: "var(--muted)" }}>{b.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function DonaPuntualidad({ aTiempo, tarde, error }: { aTiempo: number | null; tarde: number | null; error: string | null }) {
  if (aTiempo === null || tarde === null) {
    return <div style={{ padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>{error ?? "Cargando…"}</div>;
  }
  const total = aTiempo + tarde;
  const porcentaje = total > 0 ? Math.round((aTiempo / total) * 100) : 0;
  return (
    <>
      <div
        style={{
          position: "relative",
          width: 150,
          height: 150,
          margin: "18px 0 6px",
          borderRadius: "50%",
          background: `conic-gradient(var(--ok) 0 ${porcentaje}%, var(--warn) ${porcentaje}% 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 104, height: 104, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 30, color: "var(--ink)" }}>{porcentaje}%</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>a tiempo</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 6, fontSize: 12.5 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--ok)" }} />
          A tiempo ({aTiempo})
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--warn)" }} />
          Tardanza ({tarde})
        </span>
      </div>
    </>
  );
}

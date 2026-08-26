import { useMemo, useState } from "react";
import { useAutenticacion } from "@/features/auth/ContextoAutenticacion";
import EncabezadoPagina from "@/shared/components/EncabezadoPagina";
import { bucketsPorSemanaDelMes } from "@/features/dashboard/resumenBuckets";
import { navegacionPorId, RutaPanel } from "@/routes/navigationConfig";
import { useDatosPanelPrincipal } from "@/features/dashboard/hooks/useDatosPanelPrincipal";
import { bucketsPorDia, calcularPuntualidad, fechaDesdeCivil, Rango, sumarDias, UMBRAL_HORAS_INACTIVIDAD_ADMS } from "@/features/dashboard/panelPrincipalViewModel";
import { fechaLegibleEnTimezone, relojEnTimezone } from "@/features/dashboard/calendarioObra";
import PanelKpis from "@/features/dashboard/components/PanelKpis";
import PanelGraficas from "@/features/dashboard/components/PanelGraficas";
import PanelUltimasMarcaciones from "@/features/dashboard/components/PanelUltimasMarcaciones";
import PanelAccionesRapidas from "@/features/dashboard/components/PanelAccionesRapidas";

export default function PanelPrincipalPage() {
  const { sesion } = useAutenticacion();
  const token = sesion!.token;
  const [rango, setRango] = useState<Rango>("semana");
  const datos = useDatosPanelPrincipal(token, sesion!.usuario.rol, rango);
  const { hoy, hoyISO, timezoneObra, inicio, asistenciasHoy, asistenciasPeriodo, trabajadores, secciones, horarios, obraActual, terminalesAdmsInactivos } = datos;
  const hoyCivil = useMemo(() => fechaDesdeCivil(hoyISO), [hoyISO]);

  // Puntualidad depende de las dos listas: cuál horario le toca a una
  // seccion (secciones) y los datos de ese horario (horarios). Si CUALQUIERA
  // de las dos no está disponible para el rol actual, no se puede resolver.
  const cargandoPuntualidad = secciones.cargando || horarios.cargando;
  const errorPuntualidad = secciones.error ?? horarios.error;

  const totalActivos = useMemo(
    () => trabajadores.datos?.filter((t) => t.estatus === "activo").length ?? null,
    [trabajadores.datos]
  );

  const idsPresentesHoy = useMemo(
    () => new Set((asistenciasHoy.datos ?? []).map((a) => a.trabajadorId)),
    [asistenciasHoy.datos]
  );
  const ausentesHoy = totalActivos !== null ? totalActivos - idsPresentesHoy.size : null;

  const puntualidad = useMemo(
    () => {
      if (cargandoPuntualidad || errorPuntualidad || !asistenciasPeriodo.datos) return null;
      return calcularPuntualidad(asistenciasPeriodo.datos, secciones.datos ?? [], horarios.datos ?? []);
    }, [asistenciasPeriodo.datos, cargandoPuntualidad, errorPuntualidad, secciones.datos, horarios.datos]
  );
  const aTiempo = puntualidad?.aTiempo ?? null;
  const tarde = puntualidad?.tarde ?? null;

  const totalPeriodo = asistenciasPeriodo.datos?.length ?? null;
  const totalClasificable = aTiempo !== null && tarde !== null ? aTiempo + tarde : 0;
  const porcentajeATiempo = totalClasificable > 0 ? Math.round((aTiempo! / totalClasificable) * 100) : null;

  const barras = useMemo(() => {
    if (!asistenciasPeriodo.datos) return [];
    if (rango === "mes") return bucketsPorSemanaDelMes(asistenciasPeriodo.datos, inicio, hoyCivil);
    return bucketsPorDia(asistenciasPeriodo.datos, inicio, rango === "dia" ? hoyCivil : sumarDias(inicio, 4));
  }, [asistenciasPeriodo.datos, rango, inicio, hoyCivil]);

  const etiquetaPeriodo = rango === "dia" ? "hoy" : rango === "semana" ? "esta semana" : "este mes";
  const ruta = (id: RutaPanel) => navegacionPorId(id)!.path;
  return (
    <div className="precision-dashboard" style={{ padding: "26px 30px 36px" }}>
      <EncabezadoPagina
        titulo="Panel principal"
        descripcion={<span style={{ textTransform: "capitalize" }}>{fechaLegibleEnTimezone(hoy, timezoneObra)}</span>}
        metadata={<span>Resumen operativo · {relojEnTimezone(hoy, timezoneObra)}</span>}
        accion={<div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 4 }}>
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
                color: rango === r ? "var(--white)" : "var(--muted)",
              }}
            >
              {r === "dia" ? "Día" : r === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>}
      />

      <section className="obra-actual" aria-label="Obra actual">
        <span className="obra-actual-etiqueta">Obra actual</span>
        <strong>{obraActual || "Obra no configurada"}</strong>
      </section>

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

      <PanelKpis
        etiquetaPeriodo={etiquetaPeriodo}
        totalPeriodo={totalPeriodo}
        asistenciasError={asistenciasPeriodo.error}
        porcentajeATiempo={porcentajeATiempo}
        puntualidadError={errorPuntualidad}
        tarde={tarde}
        trabajadoresError={trabajadores.error}
        ausentesHoy={ausentesHoy}
        totalActivos={totalActivos}
      />

      <PanelGraficas barras={barras} cargando={asistenciasPeriodo.cargando} rango={rango} aTiempo={aTiempo} tarde={tarde} error={errorPuntualidad ?? asistenciasPeriodo.error} />

      <PanelUltimasMarcaciones asistencias={asistenciasHoy.datos} trabajadores={trabajadores.datos} secciones={secciones.datos} horarios={horarios.datos} cargando={asistenciasHoy.cargando} />
      <PanelAccionesRapidas rol={sesion!.usuario.rol} ruta={ruta} />
    </div>
  );
}

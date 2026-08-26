import { useEffect, useMemo, useState } from "react";
import { listarAsistencias } from "@/features/asistencias/api";
import { ApiError } from "@/core/api/client";
import { listarHorarios } from "@/core/api/resources/horarios";
import { listarSecciones } from "@/core/api/resources/secciones";
import { listarTerminales } from "@/features/terminales/api";
import { listarTrabajadores } from "@/features/trabajadores/api";
import { obtenerObraActual } from "@/core/api/resources/obras";
import { aFechaISO, fechaCivilActual, fechaDesdeCivil, Rango, terminalAdmsInactivo } from "@/features/dashboard/panelPrincipalViewModel";
import { rangoCivil } from "@/features/dashboard/calendarioObra";

export interface EstadoCarga<T> {
  datos: T | null;
  error: string | null;
  cargando: boolean;
}

function useCargaProtegida<T>(cargar: () => Promise<T>, deps: readonly unknown[], habilitada = true): EstadoCarga<T> {
  const [estado, setEstado] = useState<EstadoCarga<T>>(
    habilitada
      ? { datos: null, error: null, cargando: true }
      : { datos: null, error: "no disponible para tu rol", cargando: false }
  );

  useEffect(() => {
    if (!habilitada) return;
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
    // Las cargas representan explícitamente el rol y el rango que las habilitan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return habilitada
    ? estado
    : { datos: null, error: "no disponible para tu rol", cargando: false };
}

export function useDatosPanelPrincipal(token: string, rol: string, rango: Rango) {
  const tieneAccesoOperativo = rol === "rh";
  const [hoy, setHoy] = useState(() => new Date());
  const [timezoneObra, setTimezoneObra] = useState<string | null>(null);
  const [timezoneCargada, setTimezoneCargada] = useState(false);
  const [obraActual, setObraActual] = useState<string | null>(null);
  useEffect(() => {
    function actualizarSiCambioElDia() {
      setHoy(new Date());
    }
    window.addEventListener("focus", actualizarSiCambioElDia);
    document.addEventListener("visibilitychange", actualizarSiCambioElDia);
    const intervalo = setInterval(actualizarSiCambioElDia, 60_000);
    return () => {
      window.removeEventListener("focus", actualizarSiCambioElDia);
      document.removeEventListener("visibilitychange", actualizarSiCambioElDia);
      clearInterval(intervalo);
    };
  }, [timezoneObra]);

  useEffect(() => {
    obtenerObraActual(token)
      .then((respuesta) => {
        setObraActual(respuesta.obra.nombre);
        setTimezoneObra(respuesta.obra.timezoneObra);
        setTimezoneCargada(true);
      })
      .catch(() => {
        setObraActual(null);
        setTimezoneObra(null);
        setTimezoneCargada(true);
      });
  }, [token]);

  const hoyISO = fechaCivilActual(hoy, timezoneCargada ? timezoneObra : null);
  const { inicio, fin } = useMemo(() => {
    const rangoCivilActual = rangoCivil(rango, hoyISO);
    return { inicio: fechaDesdeCivil(rangoCivilActual.inicio), fin: fechaDesdeCivil(rangoCivilActual.fin) };
  }, [rango, hoyISO]);
  const asistenciasHoy = useCargaProtegida(
    () => listarAsistencias(token, { fecha: hoyISO }).then((r) => r.asistencias),
    [token, hoyISO, tieneAccesoOperativo],
    tieneAccesoOperativo
  );
  const asistenciasPeriodo = useCargaProtegida(
    () => listarAsistencias(token, { fechaInicio: aFechaISO(inicio), fechaFin: aFechaISO(fin) }).then((r) => r.asistencias),
    [token, aFechaISO(inicio), aFechaISO(fin), tieneAccesoOperativo],
    tieneAccesoOperativo
  );
  const trabajadores = useCargaProtegida(
    () => listarTrabajadores(token).then((r) => r.trabajadores),
    [token, tieneAccesoOperativo],
    tieneAccesoOperativo
  );
  const secciones = useCargaProtegida(() => listarSecciones(token).then((r) => r.secciones), [token]);
  const horarios = useCargaProtegida(
    () => listarHorarios(token).then((r) => r.horarios),
    [token, tieneAccesoOperativo],
    tieneAccesoOperativo
  );
  const terminales = useCargaProtegida(() => listarTerminales(token).then((r) => r.terminales), [token]);
  const terminalesAdmsInactivos = useMemo(
    () => (terminales.datos ?? []).filter((terminal) => terminalAdmsInactivo(terminal, hoy)),
    [terminales.datos, hoy]
  );

  return {
    hoy,
    hoyISO,
    timezoneObra: timezoneCargada ? timezoneObra : null,
    inicio,
    fin,
    obraActual,
    asistenciasHoy,
    asistenciasPeriodo,
    trabajadores,
    secciones,
    horarios,
    terminalesAdmsInactivos,
  };
}

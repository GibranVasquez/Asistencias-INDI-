import { apiClient } from "./client";

export type MetodoAsistencia = "huella" | "rostro";

export interface DatosRegistroAsistencia {
  trabajadorId: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  seccionId: string;
  turno: string;
  metodoUsado: MetodoAsistencia;
}

export interface AsistenciaRegistrada {
  id: string;
  trabajadorId: string;
  fecha: string;
  hora: string;
  seccionId: string;
  turno: string;
  metodoUsado: MetodoAsistencia;
  terminalOrigenId: string;
}

export function registrarAsistencia(token: string, datos: DatosRegistroAsistencia) {
  return apiClient.post<{ asistencia: AsistenciaRegistrada }>("/asistencias", datos, token);
}

export interface FiltrosListarAsistencias {
  fecha?: string;
  fechaInicio?: string;
  fechaFin?: string;
  seccionId?: string;
  trabajadorId?: string;
}

// Igual forma que AsistenciaRegistrada, pero fecha/hora vienen como
// datetime ISO completo (ej. "2026-07-21T00:00:00.000Z" / "1970-01-01T07:05:00.000Z")
// porque asi los serializa Prisma — no confundir con los strings simples
// YYYY-MM-DD / HH:MM que se mandan al registrar. trabajadorNombre/seccionNombre
// vienen denormalizados desde el backend: recepcion puede leer /asistencias
// pero no /trabajadores ni /secciones, asi que sin esto no habria forma de
// mostrar nombres reales para ese rol.
export interface AsistenciaListada extends AsistenciaRegistrada {
  trabajadorNombre: string;
  seccionNombre: string;
}

function aQueryString(filtros: FiltrosListarAsistencias): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) params.set(clave, valor);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listarAsistencias(token: string, filtros: FiltrosListarAsistencias = {}) {
  return apiClient.get<{ asistencias: AsistenciaListada[] }>(`/asistencias${aQueryString(filtros)}`, token);
}

// Para la pantalla de confirmación del Kiosco (modo ADMS) — la marcación
// más reciente registrada por el lector ADMS de oficina, sin importar qué
// terminal hace la pregunta (ver asistencia.service.ts,
// obtenerAsistenciaMasRecienteDeTerminal). null si el lector ADMS nunca ha
// registrado nada todavía.
export function obtenerAsistenciaReciente(token: string) {
  return apiClient.get<{ asistencia: AsistenciaListada | null }>("/asistencias/reciente", token);
}

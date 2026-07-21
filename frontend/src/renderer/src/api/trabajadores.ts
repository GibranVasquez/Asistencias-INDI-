import { apiClient } from "./client";

export type TrabajadorEstatus = "activo" | "baja";
export type TrabajadorTipo = "empleado" | "contratista" | "becario";

export interface Trabajador {
  id: string;
  nombreCompleto: string;
  categoria: string;
  jefeInmediato: string;
  tipo: TrabajadorTipo;
  estatus: TrabajadorEstatus;
  fechaIngreso: string | null;
  sueldoBase: string | null; // Decimal serializado como string
  banco: string | null;
  clabe: string | null;
  cuentaBancaria: string | null;
  infonavitPlazoMeses: number | null;
  infonavitMontoPorPeriodo: string | null;
  huellaRegistrada: boolean;
  rostroRegistrado: boolean;
  creadoEn: string;
}

// Si FALTA CUALQUIERA de estos (no solo si faltan todos): el roster de
// enrolamiento biométrico no traía estos datos para varios de los 137 —
// RH los completa después. "Completa" debe significar que de verdad se
// puede correr nómina y pagar (sueldo + datos bancarios), no que al menos
// uno de los campos ya se llenó.
export function tieneDatosNominaIncompletos(t: Trabajador): boolean {
  return (
    t.sueldoBase === null ||
    t.fechaIngreso === null ||
    t.banco === null ||
    t.clabe === null ||
    t.cuentaBancaria === null
  );
}

export interface DatosTrabajador {
  nombreCompleto: string;
  categoria: string;
  jefeInmediato: string;
  tipo?: TrabajadorTipo;
  estatus?: TrabajadorEstatus;
  fechaIngreso?: string | null;
  sueldoBase?: number | null;
  banco?: string | null;
  clabe?: string | null;
  cuentaBancaria?: string | null;
  infonavitPlazoMeses?: number | null;
  infonavitMontoPorPeriodo?: number | null;
  huellaRegistrada?: boolean;
  rostroRegistrado?: boolean;
}

export function listarTrabajadores(token: string) {
  return apiClient.get<{ trabajadores: Trabajador[] }>("/trabajadores", token);
}

export function obtenerTrabajador(token: string, id: string) {
  return apiClient.get<{ trabajador: Trabajador }>(`/trabajadores/${id}`, token);
}

export function crearTrabajador(token: string, datos: DatosTrabajador) {
  return apiClient.post<{ trabajador: Trabajador }>("/trabajadores", datos, token);
}

export function editarTrabajador(token: string, id: string, datos: Partial<DatosTrabajador>) {
  return apiClient.patch<{ trabajador: Trabajador }>(`/trabajadores/${id}`, datos, token);
}

export interface TrabajadorBasico {
  id: string;
  nombreCompleto: string;
  estatus: TrabajadorEstatus;
}

// Subconjunto sin datos sensibles (sin sueldo/banco/clabe) — accesible
// también a encargado_seccion, a diferencia de listarTrabajadores() de
// arriba (rol=rh únicamente).
export function listarTrabajadoresBasico(token: string) {
  return apiClient.get<{ trabajadores: TrabajadorBasico[] }>("/trabajadores/basico", token);
}

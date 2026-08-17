import { apiClient } from "@/core/api/client";

export type NominaEstatus = "pendiente" | "pagado" | "con_incidencia";

export interface NominaExistente {
  id: string;
  horasExtra: string;
  viaticosSemanal: string;
  viaticosMensual: string;
  descuentosVarios: string;
  aguinaldo: string | null;
  montoHorasExtra: string;
  infonavitDescuento: string;
  totalAPagar: string;
  estatus: NominaEstatus;
}

export interface VistaPreviaTrabajador {
  id: string;
  nombreCompleto: string;
  categoria: string;
  seccionesTrabajadas: string[];
  diasLaborados: number;
  datosIncompletos: boolean;
  nominaExistente: NominaExistente | null;
}

export function obtenerVistaPreviaNomina(token: string, periodoInicio: string, periodoFin: string) {
  return apiClient.get<{ trabajadores: VistaPreviaTrabajador[] }>(
    `/nominas/vista-previa?periodoInicio=${periodoInicio}&periodoFin=${periodoFin}`,
    token
  );
}

export interface CamposEditablesNomina {
  horasExtra: number;
  viaticosSemanal: number;
  viaticosMensual: number;
  descuentosVarios: number;
  aguinaldo?: number | null;
}

export interface Nomina extends CamposEditablesNomina {
  id: string;
  trabajadorId: string;
  periodoInicio: string;
  periodoFin: string;
  diasLaborados: string;
  montoSueldo: string;
  montoHorasExtra: string;
  infonavitDescuento: string;
  totalAPagar: string;
  estatus: NominaEstatus;
}

export function generarNomina(
  token: string,
  trabajadorId: string,
  periodoInicio: string,
  periodoFin: string,
  datos: CamposEditablesNomina
) {
  return apiClient.post<{ nomina: Nomina }>("/nominas", { trabajadorId, periodoInicio, periodoFin, ...datos }, token);
}

export function corregirNomina(token: string, nominaId: string, datos: CamposEditablesNomina) {
  return apiClient.patch<{ nomina: Nomina }>(`/nominas/${nominaId}`, datos, token);
}

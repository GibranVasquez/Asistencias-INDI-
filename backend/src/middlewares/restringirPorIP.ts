import { NextFunction, Request, Response } from "express";
import { isIP } from "node:net";

// Mitigación real (no hay alternativa: ver CLAUDE.md, sección ADMS,
// "Comm Key descartado 2026-07-27" — el MB10-VL no expone en su menú
// ningún mecanismo de auth propio del protocolo ADMS). `req.ip` debe estar
// en `ADMS_IPS_PERMITIDAS` (env var, IPs separadas por coma) o se rechaza
// con 403 antes de llegar siquiera a `resolverTerminalPorSN`. **Fail-closed
// en producción**: si `NODE_ENV=production` y la variable no está
// configurada, se aplica como defensa adicional; si está ausente o vacía no
// bloquea, porque un ADMS legítimo puede cambiar de red. La identidad primaria
// del dispositivo la validan los handlers mediante SN + terminal registrada y
// activa. Nunca se aceptan comodines, CIDR ni nombres como valores de lista.
function parsearIPsPermitidas(): string[] {
  return (process.env.ADMS_IPS_PERMITIDAS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0 && isIP(ip) !== 0);
}

export function restringirPorIP(req: Request, res: Response, next: NextFunction): void {
  const permitidas = parsearIPsPermitidas();

  if (permitidas.length === 0) {
    next();
    return;
  }

  const ipCliente = req.ip ?? "";
  if (!permitidas.includes(ipCliente)) {
    console.warn(`[adms] petición rechazada: IP "${ipCliente}" no está en ADMS_IPS_PERMITIDAS.`);
    res.status(403).json({ error: "Acceso no permitido desde esta red." });
    return;
  }

  next();
}

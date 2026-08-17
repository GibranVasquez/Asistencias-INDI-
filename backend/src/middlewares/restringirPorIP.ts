import { NextFunction, Request, Response } from "express";

// Mitigación real (no hay alternativa: ver CLAUDE.md, sección ADMS,
// "Comm Key descartado 2026-07-27" — el MB10-VL no expone en su menú
// ningún mecanismo de auth propio del protocolo ADMS). `req.ip` debe estar
// en `ADMS_IPS_PERMITIDAS` (env var, IPs separadas por coma) o se rechaza
// con 403 antes de llegar siquiera a `resolverTerminalPorSN`. **Fail-closed
// en producción**: si `NODE_ENV=production` y la variable no está
// configurada, se rechaza TODO /iclock/* (no se asume "sin lista, dejar
// pasar" como seguro — sin esta capa el endpoint queda sin ninguna
// protección real). Fuera de producción, si se omite, no bloquea (para no
// exigir configurarla en cada entorno de desarrollo) — pero si sí está
// configurada, se respeta igual fuera de producción. El riesgo de "la IP
// cambia y nadie se entera" que motivó (brevemente) volver esto opcional
// está cubierto por la alerta de inactividad del terminal ADMS en el
// panel principal (PanelPrincipalPage.tsx) — esa es la capa de detección; esta sigue
// siendo la de bloqueo.
function parsearIPsPermitidas(): string[] {
  return (process.env.ADMS_IPS_PERMITIDAS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);
}

export function restringirPorIP(req: Request, res: Response, next: NextFunction): void {
  const permitidas = parsearIPsPermitidas();

  if (permitidas.length === 0) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[adms] ADMS_IPS_PERMITIDAS no está configurada en producción — rechazando todas las peticiones a /iclock/* por defecto."
      );
      res.status(403).json({ error: "Acceso no permitido." });
      return;
    }
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

import { NextFunction, Request, Response } from "express";

// Mitigación explícita, capa 1 de 2 (ver también infra/terraform, WAF
// asociado al servicio de App Runner): el protocolo ADMS no tiene
// autenticación propia (ver CLAUDE.md), así que restringir por IP es la
// defensa real. Esta capa (aplicación) es la que funciona HOY, en
// cualquier entorno — local, Railway, o App Runner — y no depende de qué
// plataforma de despliegue se termine usando (todavía no decidido, ver
// CLAUDE.md "Despliegue"). El WAF es una segunda capa que solo aplica si
// se despliega en AWS específicamente.
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
      // Fail-closed: sin la variable configurada en producción, se rechaza
      // TODO (no se asume que "sin lista, dejar pasar todo" sea seguro).
      console.error(
        "[adms] ADMS_IPS_PERMITIDAS no está configurada en producción — rechazando todas las peticiones a /iclock/* por defecto."
      );
      res.status(403).json({ error: "Acceso no permitido." });
      return;
    }
    // Fuera de producción (dev local, pruebas con curl) sin la variable
    // configurada: no bloquea, para no exigir configurarla en cada
    // entorno de desarrollo. Si SÍ está configurada, se respeta igual
    // fuera de producción (para poder probar la restricción a propósito).
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

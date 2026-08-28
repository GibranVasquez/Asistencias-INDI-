import { NextFunction, Request, Response } from "express";

/**
 * Observabilidad opt-in del protocolo ADMS. Nunca registra cuerpo, query
 * completa, credenciales ni cabeceras de autorización.
 */
export function registrarSolicitudAdms(req: Request, res: Response, next: NextFunction): void {
  if (process.env.ADMS_REQUEST_LOGGING !== "true") {
    next();
    return;
  }

  const inicio = process.hrtime.bigint();
  const sn = typeof req.query.SN === "string" && req.query.SN.trim().length > 0 ? req.query.SN.trim() : "-";
  res.on("finish", () => {
    const timestamp = new Date().toISOString();
    const durationMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
    const userAgent = req.get("user-agent") ?? "-";
    console.info(
      `ADMS_REQUEST timestamp=${timestamp} method=${req.method} path=${req.baseUrl}${req.path} sn=${sn} ip=${req.ip ?? "-"} userAgent=${JSON.stringify(userAgent)} status=${res.statusCode} durationMs=${durationMs.toFixed(1)}`
    );
  });
  next();
}

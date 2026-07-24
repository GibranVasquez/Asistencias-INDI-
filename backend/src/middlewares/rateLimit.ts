import { Request } from "express";
import rateLimit from "express-rate-limit";
import { esAuthTokenPayload } from "../types/auth";
import { esAuthTerminalTokenPayload } from "../types/authTerminal";
import { verificarTokenJWT } from "../utils/jwt";

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

// El keyGenerator por defecto de express-rate-limit cuenta por IP. Este
// limitador se monta en app.ts ANTES del router (y por lo tanto antes de
// authMiddleware/terminalAuthMiddleware, que son por-router), así que con el
// default, RH usando el panel todo el día + recepción viendo la lista +
// el kiosco marcando huellas — todos detrás de la misma IP de salida de la
// oficina — comparten un solo cupo aunque cada quien esté haciendo trabajo
// normal e independiente. Se decodifica el JWT aquí (con la misma
// verificación de firma que usa authMiddleware, no un simple decode) solo
// para extraer una clave de cupo por usuario/terminal; si no hay token
// válido (ej. el login mismo, o un request no autenticado), cae a IP como
// respaldo — ahí sí no hay otra identidad que usar.
function claveDeCupo(req: Request): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    const resultado = verificarTokenJWT(req.header("authorization"), secret);
    if (resultado.valido) {
      if (esAuthTokenPayload(resultado.payload)) return `usuario:${resultado.payload.usuarioId}`;
      if (esAuthTerminalTokenPayload(resultado.payload)) return `terminal:${resultado.payload.terminalId}`;
    }
  }
  return req.ip ?? "sin-ip";
}

// /nominas tiene su propio limitador (limitadorInterno, más generoso) para
// captura masiva de nómina semanal (~137 POST/PATCH de un jalón) — este
// limitador general vuelve a su valor conservador original y ya no cuenta
// esas requests, en vez de subirle el límite a TODA la API por una sola
// ruta de uso interno. /health también se excluye: Railway (u otro
// orquestador) lo golpea cada pocos segundos para healthcheck, sin JWT —
// caería en el cupo por IP, no por usuario, y no tiene sentido que un
// probe de infraestructura compita por ese cupo con tráfico real.
//
// Con cupo por usuario/terminal (no por IP), 300/15min en producción ya es
// generoso: Encargado de sección refresca su resumen cada 20s (ver
// EncargadoPage.tsx, INTERVALO_POLL_MS) — son ~45 requests/15min solo de
// ese polling — más navegación normal deja bastante margen, y sigue siendo
// un backstop real ante un bug de loop/reintento (un loop de verdad agota
// 300 en segundos, no en 15 minutos). Fuera de producción se mantiene alto
// (2000) porque StrictMode duplica cada efecto de montaje en dev y las
// pruebas E2E generan mucho más tráfico del real.
export const limitadorGlobal = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: process.env.NODE_ENV === "production" ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
  skip: (req) => req.path.startsWith("/nominas") || req.path === "/health",
  keyGenerator: claveDeCupo,
});

// Limite alto (no ilimitado: sigue siendo un backstop ante un bug de
// loop/reintento) para rutas autenticadas de uso interno con operaciones en
// lote legítimas, como generar/corregir nómina de ~137 trabajadores de un
// jalón. rol=rh ya gatea el acceso; esto no reemplaza esa autorización, solo
// evita que el limitador genérico (pensado para tráfico normal) tumbe un
// flujo de captura masiva real.
export const limitadorInterno = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
});

// 5/15min es el límite real contra fuerza bruta en producción. Fuera de
// producción se afloja a 50/15min: con el estricto, un rato de pruebas
// manuales o un E2E corriendo varios logins agota el contador (en memoria,
// no se resetea hasta reiniciar el proceso) y bloquea el login por 15
// minutos aunque el usuario/contraseña sean correctos.
export const limitadorLogin = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: process.env.NODE_ENV === "production" ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
});

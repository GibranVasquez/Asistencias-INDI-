import rateLimit from "express-rate-limit";

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

// /nominas tiene su propio limitador (limitadorInterno, más generoso) para
// captura masiva de nómina semanal (~137 POST/PATCH de un jalón) — este
// limitador general vuelve a su valor conservador original y ya no cuenta
// esas requests, en vez de subirle el límite a TODA la API por una sola
// ruta de uso interno.
export const limitadorGlobal = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
  skip: (req) => req.path.startsWith("/nominas"),
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

export const limitadorLogin = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.",
  },
});

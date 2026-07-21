import rateLimit from "express-rate-limit";

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

export const limitadorGlobal = rateLimit({
  windowMs: QUINCE_MINUTOS_MS,
  max: 100,
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

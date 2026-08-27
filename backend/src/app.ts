import cors from "cors";
// { quiet: true }: ver el mismo comentario en prisma.config.ts — sin esto,
// dotenv 17+ imprime un "tip" a stdout en cada arranque del servidor.
import { config as cargarDotenv } from "dotenv";
cargarDotenv({ quiet: true });
import express from "express";
import helmet from "helmet";
import { validarVariablesDeEntorno } from "./config/env";
import { crearOpcionesCors } from "./config/cors";
import { errorHandler } from "./middlewares/errorHandler";
import { limitadorGlobal } from "./middlewares/rateLimit";
import { bloquearDuranteMantenimiento } from "./middlewares/maintenance";
import { router } from "./routes";

validarVariablesDeEntorno();

export const app = express();

// "1" = confiar en exactamente UN salto de proxy delante de este proceso
// (el balanceador/edge administrado de Railway o App Runner — ninguno de
// los dos expone el contenedor directo a internet). Sin esto, req.ip
// devuelve la IP del balanceador, no la del cliente real, una vez
// desplegado — rompe silenciosamente tanto el keying por IP del rate
// limiter (middlewares/rateLimit.ts) como el allowlist de IP del endpoint
// ADMS (middlewares/restringirPorIP.ts): todo el tráfico externo
// parecería venir de una sola IP (la del balanceador). "1" en vez de
// `true` (que confiaría en una cadena arbitraria de X-Forwarded-For,
// falsificable si el proceso alguna vez quedara alcanzable por otra ruta)
// — ver Express docs sobre trust proxy.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(crearOpcionesCors()));
app.use(express.json({ limit: "1mb" }));
// Congelamiento global antes de rate limits, autenticación y routers. GET no
// implica lectura necesariamente (handshake ADMS y exports escriben), por eso
// la única excepción funcional es /health.
app.use(bloquearDuranteMantenimiento);
app.use(limitadorGlobal);
app.use(router);
app.use(errorHandler);

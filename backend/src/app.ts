import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { validarVariablesDeEntorno } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { limitadorGlobal } from "./middlewares/rateLimit";
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
app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(limitadorGlobal);
app.use(router);
app.use(errorHandler);

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

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(limitadorGlobal);
app.use(router);
app.use(errorHandler);

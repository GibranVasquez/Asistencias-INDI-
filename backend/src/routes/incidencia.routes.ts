import { RolUsuario } from "@prisma/client";
import { Router } from "express";
import { listar } from "../controllers/incidencia.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarFiltroIncidencias } from "../middlewares/validarIncidencias";

export const incidenciaRouter = Router();
incidenciaRouter.use(authMiddleware, permitirRoles(RolUsuario.administrador, RolUsuario.rh));
incidenciaRouter.get("/", validarFiltroIncidencias, listar);

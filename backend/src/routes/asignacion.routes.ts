import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { crear, listar, sugerencia } from "../controllers/asignacion.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarAltaAsignacion, validarSugerenciaAsignacion } from "../middlewares/validarAsignacion";

export const asignacionRouter = Router();

asignacionRouter.use(authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.encargado_seccion));

asignacionRouter.post("/", validarAltaAsignacion, crear);
asignacionRouter.get("/", validarSugerenciaAsignacion, listar);
asignacionRouter.get("/sugerencia", validarSugerenciaAsignacion, sugerencia);

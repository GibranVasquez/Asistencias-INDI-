import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { listar, registrar } from "../controllers/asistencia.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { terminalAuthMiddleware } from "../middlewares/terminalAuthMiddleware";
import { validarAsistencia, validarFiltroAsistencia } from "../middlewares/validarAsistencia";

export const asistenciaRouter = Router();

asistenciaRouter.post("/", terminalAuthMiddleware, validarAsistencia, registrar);
asistenciaRouter.get(
  "/",
  authMiddleware,
  permitirRoles(RolUsuario.rh, RolUsuario.recepcion, RolUsuario.encargado_seccion),
  validarFiltroAsistencia,
  listar
);

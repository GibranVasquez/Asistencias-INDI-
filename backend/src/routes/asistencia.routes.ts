import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { listar, reciente, registrar } from "../controllers/asistencia.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { terminalAuthMiddleware } from "../middlewares/terminalAuthMiddleware";
import { validarAsistencia, validarFiltroAsistencia } from "../middlewares/validarAsistencia";

export const asistenciaRouter = Router();

asistenciaRouter.post("/", terminalAuthMiddleware, validarAsistencia, registrar);
// Antes de "/": para la pantalla de confirmación del Kiosco en modo ADMS
// (polling). Solo terminalAuthMiddleware, sin permitirRoles — el terminal
// es su propia identidad, no un Usuario con rol.
asistenciaRouter.get("/reciente", terminalAuthMiddleware, reciente);
asistenciaRouter.get(
  "/",
  authMiddleware,
  permitirRoles(RolUsuario.rh, RolUsuario.recepcion, RolUsuario.encargado_seccion),
  validarFiltroAsistencia,
  listar
);

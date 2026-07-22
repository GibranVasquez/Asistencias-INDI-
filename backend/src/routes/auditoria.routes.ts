import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { listar } from "../controllers/auditoria.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarFiltroAuditoria } from "../middlewares/validarAuditoria";

export const auditoriaRouter = Router();

auditoriaRouter.use(authMiddleware, permitirRoles(RolUsuario.administrador));

auditoriaRouter.get("/", validarFiltroAuditoria, listar);

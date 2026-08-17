import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { obtenerActual, editarActual } from "../controllers/obra.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarEdicionObra } from "../middlewares/validarObra";

export const obraRouter = Router();

obraRouter.get("/actual", authMiddleware, permitirRoles(RolUsuario.administrador, RolUsuario.rh), obtenerActual);
obraRouter.patch("/actual", authMiddleware, permitirRoles(RolUsuario.administrador), validarEdicionObra, editarActual);

import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { crear, listar } from "../controllers/terminal.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarAltaTerminal } from "../middlewares/validarAltaTerminal";

export const terminalRouter = Router();

terminalRouter.get("/", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), listar);
terminalRouter.post("/", authMiddleware, permitirRoles(RolUsuario.administrador), validarAltaTerminal, crear);

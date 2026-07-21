import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { cambiarEstado, crear, listar } from "../controllers/usuario.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarAltaUsuario } from "../middlewares/validarAltaUsuario";
import { validarCambioEstadoUsuario } from "../middlewares/validarCambioEstadoUsuario";

export const usuarioRouter = Router();

usuarioRouter.get("/", authMiddleware, permitirRoles(RolUsuario.administrador), listar);
usuarioRouter.post("/", authMiddleware, permitirRoles(RolUsuario.administrador), validarAltaUsuario, crear);
usuarioRouter.patch(
  "/:id/estado",
  authMiddleware,
  permitirRoles(RolUsuario.administrador),
  validarCambioEstadoUsuario,
  cambiarEstado
);

import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { borrar, crear, editar, listar, obtener } from "../controllers/horario.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { permitirTerminalOUsuarioConRol } from "../middlewares/authTerminalOUsuario";
import { validarAltaHorario, validarEdicionHorario, validarIdHorario } from "../middlewares/validarHorario";

export const horarioRouter = Router();

// Lectura: un Terminal (kiosco) puede necesitar el catálogo de horarios,
// sin heredar el resto de permisos de RH.
horarioRouter.get("/", permitirTerminalOUsuarioConRol(RolUsuario.rh), listar);
horarioRouter.get("/:id", permitirTerminalOUsuarioConRol(RolUsuario.rh), validarIdHorario, obtener);

horarioRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

horarioRouter.post("/", validarAltaHorario, crear);
horarioRouter.patch("/:id", validarEdicionHorario, editar);
horarioRouter.delete("/:id", validarIdHorario, borrar);

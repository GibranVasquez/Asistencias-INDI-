import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { aplicarATodos, borrar, crear, editar, listar, obtener } from "../controllers/categoriaTrabajador.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import {
  validarAltaCategoriaTrabajador,
  validarAplicarATodos,
  validarEdicionCategoriaTrabajador,
  validarIdCategoriaTrabajador,
} from "../middlewares/validarCategoriaTrabajador";

export const categoriaTrabajadorRouter = Router();

categoriaTrabajadorRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

categoriaTrabajadorRouter.post("/", validarAltaCategoriaTrabajador, crear);
categoriaTrabajadorRouter.get("/", listar);
categoriaTrabajadorRouter.get("/:id", validarIdCategoriaTrabajador, obtener);
categoriaTrabajadorRouter.patch("/:id", validarEdicionCategoriaTrabajador, editar);
categoriaTrabajadorRouter.delete("/:id", validarIdCategoriaTrabajador, borrar);
categoriaTrabajadorRouter.post("/:id/aplicar-a-todos", validarAplicarATodos, aplicarATodos);

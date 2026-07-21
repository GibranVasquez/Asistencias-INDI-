import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { borrar, crear, editar, listar, obtener } from "../controllers/movimientoTrabajador.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  validarAltaMovimiento,
  validarEdicionMovimiento,
  validarFiltroMovimientos,
  validarIdMovimiento,
} from "../middlewares/validarMovimientoTrabajador";
import { permitirRoles } from "../middlewares/role.middleware";

export const movimientoTrabajadorRouter = Router();

movimientoTrabajadorRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

movimientoTrabajadorRouter.post("/", validarAltaMovimiento, crear);
movimientoTrabajadorRouter.get("/", validarFiltroMovimientos, listar);
movimientoTrabajadorRouter.get("/:id", validarIdMovimiento, obtener);
movimientoTrabajadorRouter.patch("/:id", validarEdicionMovimiento, editar);
movimientoTrabajadorRouter.delete("/:id", validarIdMovimiento, borrar);

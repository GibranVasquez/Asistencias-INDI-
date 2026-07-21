import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { borrar, crear, editar, listar, obtener } from "../controllers/tipoMovimiento.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import {
  validarAltaTipoMovimiento,
  validarEdicionTipoMovimiento,
  validarIdTipoMovimiento,
} from "../middlewares/validarTipoMovimiento";

export const tipoMovimientoRouter = Router();

tipoMovimientoRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

tipoMovimientoRouter.post("/", validarAltaTipoMovimiento, crear);
tipoMovimientoRouter.get("/", listar);
tipoMovimientoRouter.get("/:id", validarIdTipoMovimiento, obtener);
tipoMovimientoRouter.patch("/:id", validarEdicionTipoMovimiento, editar);
tipoMovimientoRouter.delete("/:id", validarIdTipoMovimiento, borrar);

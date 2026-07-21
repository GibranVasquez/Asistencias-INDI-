import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { borrar, crear, editar, listar, obtener } from "../controllers/tarifaHoraExtra.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import {
  validarAltaTarifaHoraExtra,
  validarEdicionTarifaHoraExtra,
  validarIdTarifaHoraExtra,
} from "../middlewares/validarTarifaHoraExtra";

export const tarifaHoraExtraRouter = Router();

tarifaHoraExtraRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

tarifaHoraExtraRouter.post("/", validarAltaTarifaHoraExtra, crear);
tarifaHoraExtraRouter.get("/", listar);
tarifaHoraExtraRouter.get("/:id", validarIdTarifaHoraExtra, obtener);
tarifaHoraExtraRouter.patch("/:id", validarEdicionTarifaHoraExtra, editar);
tarifaHoraExtraRouter.delete("/:id", validarIdTarifaHoraExtra, borrar);

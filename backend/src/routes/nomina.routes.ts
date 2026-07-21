import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { corregir, generar, listar, obtener } from "../controllers/nomina.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarCorreccionNomina } from "../middlewares/validarCorreccionNomina";
import { validarFiltroNomina, validarIdNomina, validarNomina } from "../middlewares/validarNomina";

export const nominaRouter = Router();

nominaRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

nominaRouter.post("/", validarNomina, generar);
nominaRouter.get("/", validarFiltroNomina, listar);
nominaRouter.get("/:id", validarIdNomina, obtener);
nominaRouter.patch("/:id", validarCorreccionNomina, corregir);

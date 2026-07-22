import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { corregir, generar, listar, obtener, vistaPrevia } from "../controllers/nomina.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { limitadorInterno } from "../middlewares/rateLimit";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarCorreccionNomina } from "../middlewares/validarCorreccionNomina";
import {
  validarFiltroNomina,
  validarIdNomina,
  validarNomina,
  validarVistaPreviaNomina,
} from "../middlewares/validarNomina";

export const nominaRouter = Router();

nominaRouter.use(limitadorInterno, authMiddleware, permitirRoles(RolUsuario.rh));

nominaRouter.post("/", validarNomina, generar);
nominaRouter.get("/", validarFiltroNomina, listar);
// Antes de /:id: "vista-previa" no debe resolverse como un id de nomina.
nominaRouter.get("/vista-previa", validarVistaPreviaNomina, vistaPrevia);
nominaRouter.get("/:id", validarIdNomina, obtener);
nominaRouter.patch("/:id", validarCorreccionNomina, corregir);

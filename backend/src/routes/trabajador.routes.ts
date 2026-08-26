import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { aplicarSueldo, basico, borrar, candidatoReconciliacion, crear, editar, listar, obtener } from "../controllers/trabajador.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import {
  validarAltaTrabajador,
  validarAplicarSueldoMasivo,
  validarEdicionTrabajador,
  validarIdTrabajador,
  validarPinCandidato,
} from "../middlewares/validarTrabajador";

export const trabajadorRouter = Router();

// Subconjunto de solo lectura (id+nombreCompleto+estatus) para encargado_seccion
// (ej. armar una asignación diaria) — antes del blanket rh de abajo, mismo
// patrón que /secciones/:id/hoy.
trabajadorRouter.get("/basico", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.encargado_seccion), basico);
trabajadorRouter.get("/candidato-reconciliacion", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), validarPinCandidato, candidatoReconciliacion);

trabajadorRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

trabajadorRouter.post("/", validarAltaTrabajador, crear);
trabajadorRouter.post("/aplicar-sueldo", validarAplicarSueldoMasivo, aplicarSueldo);
trabajadorRouter.get("/", listar);
trabajadorRouter.get("/:id", validarIdTrabajador, obtener);
trabajadorRouter.patch("/:id", validarEdicionTrabajador, editar);
trabajadorRouter.delete("/:id", validarIdTrabajador, borrar);

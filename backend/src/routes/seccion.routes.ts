import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { asignarResponsable, borrar, crear, editar, hoy, listar, obtener, responsables, retirarResponsable, trabajadoresResponsables } from "../controllers/seccion.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { permitirTerminalOUsuarioConRol } from "../middlewares/authTerminalOUsuario";
import { validarAltaSeccion, validarEdicionSeccion, validarFiltroObra, validarIdSeccion, validarTrabajadorResponsable } from "../middlewares/validarSeccion";

export const seccionRouter = Router();

// Registrada antes del router.use(permitirRoles(rh)) de abajo: encargado_seccion
// necesita ver ESTE endpoint (con su propio scoping via verificarAccesoSeccion),
// pero ningún otro endpoint de /secciones.
seccionRouter.get(
  "/:id/hoy",
  authMiddleware,
  permitirRoles(RolUsuario.rh, RolUsuario.encargado_seccion),
  validarIdSeccion,
  hoy
);

// Lectura: un Terminal (kiosco) necesita el catálogo de secciones para
// configurarse, sin heredar el resto de permisos de RH; administrador lo
// necesita para el multi-select de secciones al dar de alta una cuenta
// encargado_seccion (Usuarios y accesos) — por eso estas dos van antes del
// blanket de abajo, con su propio middleware combinado.
seccionRouter.get("/", permitirTerminalOUsuarioConRol(RolUsuario.rh, RolUsuario.administrador), validarFiltroObra, listar);
seccionRouter.get(
  "/:id",
  permitirTerminalOUsuarioConRol(RolUsuario.rh, RolUsuario.administrador),
  validarIdSeccion,
  obtener
);

seccionRouter.get("/responsables/elegibles", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), trabajadoresResponsables);
seccionRouter.get("/:id/responsables", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), validarIdSeccion, responsables);
seccionRouter.post("/:id/responsables", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), validarIdSeccion, validarTrabajadorResponsable, asignarResponsable);
seccionRouter.delete("/:id/responsables/:trabajadorId", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), validarIdSeccion, validarTrabajadorResponsable, retirarResponsable);

seccionRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

seccionRouter.post("/", validarAltaSeccion, crear);
seccionRouter.patch("/:id", validarEdicionSeccion, editar);
seccionRouter.delete("/:id", validarIdSeccion, borrar);

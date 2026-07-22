import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import { cambiarEstado, crear, encargados, listar } from "../controllers/usuario.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import { validarAltaUsuario } from "../middlewares/validarAltaUsuario";
import { validarCambioEstadoUsuario } from "../middlewares/validarCambioEstadoUsuario";

export const usuarioRouter = Router();

// Subconjunto mínimo (id+username de cuentas rol=encargado_seccion), también
// para rh: arma el multi-select de encargados en Secciones (Configuración)
// sin abrirle el resto de GET /usuarios (rol=administrador). Antes del
// blanket de abajo, mismo patrón que /trabajadores/basico.
usuarioRouter.get("/encargados", authMiddleware, permitirRoles(RolUsuario.rh, RolUsuario.administrador), encargados);

usuarioRouter.get("/", authMiddleware, permitirRoles(RolUsuario.administrador), listar);
usuarioRouter.post("/", authMiddleware, permitirRoles(RolUsuario.administrador), validarAltaUsuario, crear);
usuarioRouter.patch(
  "/:id/estado",
  authMiddleware,
  permitirRoles(RolUsuario.administrador),
  validarCambioEstadoUsuario,
  cambiarEstado
);

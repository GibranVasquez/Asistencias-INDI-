import { Router } from "express";
import { RolUsuario } from "@prisma/client";
import {
  asistencia,
  exportarAsistencia,
  exportarNomina,
  historicoTrabajador,
  nomina,
} from "../controllers/reportes.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { permitirRoles } from "../middlewares/role.middleware";
import {
  validarExportarAsistencia,
  validarExportarNomina,
  validarFiltroReporteAsistencia,
  validarFiltroReporteNomina,
  validarHistoricoTrabajador,
} from "../middlewares/validarReportes";

export const reportesRouter = Router();

// rol=rh en todo el router: el financiero de nómina es sensible, y mantener
// un único rol para toda /reportes evita gatear cada ruta por separado.
reportesRouter.use(authMiddleware, permitirRoles(RolUsuario.rh));

reportesRouter.get("/asistencia", validarFiltroReporteAsistencia, asistencia);
reportesRouter.get("/asistencia/exportar", validarExportarAsistencia, exportarAsistencia);
reportesRouter.get("/asistencia/trabajador/:id", validarHistoricoTrabajador, historicoTrabajador);
reportesRouter.get("/nomina", validarFiltroReporteNomina, nomina);
reportesRouter.get("/nomina/exportar", validarExportarNomina, exportarNomina);

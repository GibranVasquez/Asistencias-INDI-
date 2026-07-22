import { Router } from "express";
import { asignacionRouter } from "./asignacion.routes";
import { asistenciaRouter } from "./asistencia.routes";
import { auditoriaRouter } from "./auditoria.routes";
import { authRouter } from "./auth.routes";
import { horarioRouter } from "./horario.routes";
import { movimientoTrabajadorRouter } from "./movimientoTrabajador.routes";
import { nominaRouter } from "./nomina.routes";
import { seccionRouter } from "./seccion.routes";
import { tarifaHoraExtraRouter } from "./tarifaHoraExtra.routes";
import { terminalRouter } from "./terminal.routes";
import { tipoMovimientoRouter } from "./tipoMovimiento.routes";
import { trabajadorRouter } from "./trabajador.routes";
import { usuarioRouter } from "./usuario.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/auditoria", auditoriaRouter);
router.use("/asistencias", asistenciaRouter);
router.use("/nominas", nominaRouter);
router.use("/usuarios", usuarioRouter);
router.use("/terminales", terminalRouter);
router.use("/secciones", seccionRouter);
router.use("/horarios", horarioRouter);
router.use("/tipos-movimiento", tipoMovimientoRouter);
router.use("/tarifas-hora-extra", tarifaHoraExtraRouter);
router.use("/trabajadores", trabajadorRouter);
router.use("/movimientos", movimientoTrabajadorRouter);
router.use("/asignaciones", asignacionRouter);

-- CreateIndex
CREATE UNIQUE INDEX "uq_asistencias_trabajador_terminal_fecha_hora" ON "asistencias_diarias"("trabajador_id", "terminal_origen_id", "fecha", "hora");


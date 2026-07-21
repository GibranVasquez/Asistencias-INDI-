-- CreateTable
CREATE TABLE "asignaciones_diarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajador_id" UUID NOT NULL,
    "seccion_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "asignado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_asignaciones_seccion_fecha" ON "asignaciones_diarias"("seccion_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_diarias_trabajador_id_fecha_key" ON "asignaciones_diarias"("trabajador_id", "fecha");

-- AddForeignKey
ALTER TABLE "asignaciones_diarias" ADD CONSTRAINT "asignaciones_diarias_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_diarias" ADD CONSTRAINT "asignaciones_diarias_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "secciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_diarias" ADD CONSTRAINT "asignaciones_diarias_asignado_por_fkey" FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

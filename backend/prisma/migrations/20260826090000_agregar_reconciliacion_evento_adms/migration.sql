-- Expand: vincula eventos ADMS con su asistencia y actor, sin backfill.
ALTER TABLE "eventos_no_reconciliados"
ADD COLUMN "asistencia_id" UUID,
ADD COLUMN "reconciliado_en" TIMESTAMPTZ(6),
ADD COLUMN "reconciliado_por_id" UUID;

ALTER TABLE "eventos_no_reconciliados"
ADD CONSTRAINT "eventos_no_reconciliados_asistencia_id_fkey"
FOREIGN KEY ("asistencia_id") REFERENCES "asistencias_diarias"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "eventos_no_reconciliados_reconciliado_por_id_fkey"
FOREIGN KEY ("reconciliado_por_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Expand: vincula terminales y eventos ADMS con una Obra sin backfill.
ALTER TABLE "terminales"
ADD COLUMN "obra_id" UUID;

ALTER TABLE "eventos_no_reconciliados"
ADD COLUMN "obra_id" UUID;

CREATE INDEX "idx_terminales_obra" ON "terminales"("obra_id");
CREATE INDEX "idx_eventos_no_reconciliados_obra" ON "eventos_no_reconciliados"("obra_id");

ALTER TABLE "terminales"
ADD CONSTRAINT "terminales_obra_id_fkey"
FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "eventos_no_reconciliados"
ADD CONSTRAINT "eventos_no_reconciliados_obra_id_fkey"
FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

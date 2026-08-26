-- Expand: los campos civiles permanecen NULL para históricos y no se realiza backfill.
ALTER TABLE "eventos_no_reconciliados"
ADD COLUMN "fecha_marcacion" DATE,
ADD COLUMN "hora_marcacion" TIME(0);

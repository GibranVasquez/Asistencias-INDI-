-- FASE 1 expand-first: conserva el contexto de Obra y permite asistencias
-- válidas sin AsignacionDiaria (seccion_id NULL).
ALTER TABLE "asistencias_diarias"
ADD COLUMN "obra_id" UUID;

UPDATE "asistencias_diarias" AS a
SET "obra_id" = s."obra_id"
FROM "secciones" AS s
WHERE s."id" = a."seccion_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "asistencias_diarias" WHERE "obra_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill de obra_id incompleto: existen asistencias sin Obra';
  END IF;
END $$;

ALTER TABLE "asistencias_diarias"
ADD CONSTRAINT "asistencias_diarias_obra_id_fkey"
FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_asistencias_obra_fecha"
ON "asistencias_diarias"("obra_id", "fecha");

-- Compatibilidad transitoria durante el rollout expand-first: mientras pueda
-- existir una instancia del backend anterior, completa obra_id a partir de la
-- sección que ese backend todavía escribe. No inventa una Obra cuando la
-- sección es NULL; la aplicación nueva debe rechazar ese caso para ADMS.
CREATE OR REPLACE FUNCTION completar_obra_asistencia_desde_seccion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.obra_id IS NULL AND NEW.seccion_id IS NOT NULL THEN
    SELECT s.obra_id
      INTO NEW.obra_id
      FROM "secciones" AS s
     WHERE s.id = NEW.seccion_id;

    IF NEW.obra_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo resolver Obra para seccion_id %', NEW.seccion_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asistencia_completar_obra_legacy
BEFORE INSERT OR UPDATE OF obra_id, seccion_id ON "asistencias_diarias"
FOR EACH ROW
EXECUTE FUNCTION completar_obra_asistencia_desde_seccion();

ALTER TABLE "asistencias_diarias"
ALTER COLUMN "seccion_id" DROP NOT NULL;

-- Este trigger es temporal. En FASE 2, tras verificar que todo el código
-- productivo escribe obra_id: comprobar ausencia de NULL, eliminar trigger y
-- función, y aplicar obra_id SET NOT NULL junto con la relación Prisma obligatoria.

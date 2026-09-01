-- Soporte semántico para las seis opciones de punch del ZKTeco S922.
-- Expand-first: ambos campos son nullable para preservar históricos sin dato.
CREATE TYPE "tipo_marcacion" AS ENUM (
  'entrada',
  'salida',
  'salida_descanso',
  'entrada_descanso',
  'entrada_tiempo_extra',
  'salida_tiempo_extra'
);

ALTER TABLE "asistencias_diarias"
  ADD COLUMN "tipo_marcacion" "tipo_marcacion",
  ADD COLUMN "punch_crudo" INTEGER;

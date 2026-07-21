-- AlterEnum
ALTER TYPE "trabajador_tipo" ADD VALUE 'becario';

-- AlterEnum
BEGIN;
CREATE TYPE "trabajador_estatus_new" AS ENUM ('activo', 'baja');
ALTER TABLE "trabajadores" ALTER COLUMN "estatus" DROP DEFAULT;
ALTER TABLE "trabajadores" ALTER COLUMN "estatus" TYPE "trabajador_estatus_new" USING ("estatus"::text::"trabajador_estatus_new");
ALTER TYPE "trabajador_estatus" RENAME TO "trabajador_estatus_old";
ALTER TYPE "trabajador_estatus_new" RENAME TO "trabajador_estatus";
ALTER TABLE "trabajadores" ALTER COLUMN "estatus" SET DEFAULT 'activo';
DROP TYPE "trabajador_estatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bloqueado_hasta" TIMESTAMPTZ(6),
ADD COLUMN     "intentos_fallidos" INTEGER NOT NULL DEFAULT 0;

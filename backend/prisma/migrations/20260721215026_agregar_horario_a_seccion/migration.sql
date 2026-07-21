-- AlterTable
ALTER TABLE "secciones" ADD COLUMN     "horario_id" UUID;

-- CreateIndex
CREATE INDEX "idx_secciones_horario" ON "secciones"("horario_id");

-- AddForeignKey
ALTER TABLE "secciones" ADD CONSTRAINT "secciones_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

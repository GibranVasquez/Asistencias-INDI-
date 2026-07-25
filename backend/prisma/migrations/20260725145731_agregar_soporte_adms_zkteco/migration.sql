-- AlterTable
ALTER TABLE "trabajadores" ADD COLUMN     "numero_checador" INTEGER;

-- AlterTable
ALTER TABLE "terminales" ADD COLUMN     "numero_serie" TEXT;

-- CreateTable
CREATE TABLE "eventos_no_reconciliados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "terminal_id" UUID NOT NULL,
    "pin_dispositivo" TEXT NOT NULL,
    "marcado_en" TIMESTAMPTZ(6) NOT NULL,
    "metodo_crudo" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_no_reconciliados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_numero_checador_key" ON "trabajadores"("numero_checador");

-- CreateIndex
CREATE UNIQUE INDEX "terminales_numero_serie_key" ON "terminales"("numero_serie");

-- CreateIndex
CREATE INDEX "idx_eventos_no_reconciliados_terminal" ON "eventos_no_reconciliados"("terminal_id");

-- AddForeignKey
ALTER TABLE "eventos_no_reconciliados" ADD CONSTRAINT "eventos_no_reconciliados_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

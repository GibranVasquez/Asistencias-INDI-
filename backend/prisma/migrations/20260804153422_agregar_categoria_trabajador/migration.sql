-- CreateTable
CREATE TABLE "categorias_trabajador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "sueldo_base_default" DECIMAL(12,2),
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_trabajador_nombre_key" ON "categorias_trabajador"("nombre");

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('trabajador', 'recepcion', 'encargado_seccion', 'rh', 'administrador');

-- CreateEnum
CREATE TYPE "trabajador_tipo" AS ENUM ('empleado', 'contratista');

-- CreateEnum
CREATE TYPE "trabajador_estatus" AS ENUM ('activo', 'baja', 'becario');

-- CreateEnum
CREATE TYPE "metodo_asistencia" AS ENUM ('huella', 'rostro');

-- CreateEnum
CREATE TYPE "nomina_estatus" AS ENUM ('pendiente', 'pagado', 'con_incidencia');

-- CreateEnum
CREATE TYPE "estado_conexion_terminal" AS ENUM ('conectado', 'desconectado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "trabajador_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajadores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_completo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "jefe_inmediato" TEXT NOT NULL,
    "tipo" "trabajador_tipo" NOT NULL DEFAULT 'empleado',
    "fecha_ingreso" DATE NOT NULL,
    "sueldo_base" DECIMAL(12,2) NOT NULL,
    "banco" TEXT NOT NULL,
    "clabe" TEXT NOT NULL,
    "cuenta_bancaria" TEXT NOT NULL,
    "infonavit_plazo_meses" INTEGER,
    "huella_registrada" BOOLEAN NOT NULL DEFAULT false,
    "rostro_registrado" BOOLEAN NOT NULL DEFAULT false,
    "estatus" "trabajador_estatus" NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "hora_entrada" TIME(0) NOT NULL,
    "hora_salida" TIME(0) NOT NULL,
    "tolerancia_minutos" INTEGER NOT NULL,
    "receso_inicio" TIME(0),
    "receso_fin" TIME(0),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias_diarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajador_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TIME(0) NOT NULL,
    "seccion_id" UUID NOT NULL,
    "turno" TEXT NOT NULL,
    "metodo_usado" "metodo_asistencia" NOT NULL,
    "terminal_origen_id" UUID NOT NULL,
    "ubicacion_gps" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asistencias_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_movimiento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "cuenta_como_dia_trabajado" BOOLEAN NOT NULL,
    "es_informativo" BOOLEAN NOT NULL,
    "requiere_autorizacion" BOOLEAN NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_trabajador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajador_id" UUID NOT NULL,
    "tipo_movimiento_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "nota" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_hora_extra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "valor" DECIMAL(10,2) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarifas_hora_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominas_semanales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trabajador_id" UUID NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fin" DATE NOT NULL,
    "dias_laborados" DECIMAL(4,2) NOT NULL,
    "monto_sueldo" DECIMAL(12,2) NOT NULL,
    "horas_extra" DECIMAL(6,2) NOT NULL,
    "monto_horas_extra" DECIMAL(12,2) NOT NULL,
    "viaticos_semanal" DECIMAL(12,2) NOT NULL,
    "viaticos_mensual" DECIMAL(12,2) NOT NULL,
    "infonavit_descuento" DECIMAL(12,2) NOT NULL,
    "descuentos_varios" DECIMAL(12,2) NOT NULL,
    "aguinaldo" DECIMAL(12,2),
    "total_a_pagar" DECIMAL(12,2) NOT NULL,
    "estatus" "nomina_estatus" NOT NULL DEFAULT 'pendiente',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nominas_semanales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "estado_conexion" "estado_conexion_terminal" NOT NULL DEFAULT 'desconectado',
    "ultima_sincronizacion" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SeccionEncargados" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_SeccionEncargados_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_trabajador_id_key" ON "usuarios"("trabajador_id");

-- CreateIndex
CREATE INDEX "idx_usuarios_rol" ON "usuarios"("rol");

-- CreateIndex
CREATE INDEX "idx_trabajadores_estatus" ON "trabajadores"("estatus");

-- CreateIndex
CREATE INDEX "idx_secciones_obra" ON "secciones"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "secciones_obra_id_nombre_key" ON "secciones"("obra_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_nombre_key" ON "horarios"("nombre");

-- CreateIndex
CREATE INDEX "idx_asistencias_trabajador_fecha" ON "asistencias_diarias"("trabajador_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_asistencias_seccion_fecha" ON "asistencias_diarias"("seccion_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_movimiento_nombre_key" ON "tipos_movimiento"("nombre");

-- CreateIndex
CREATE INDEX "idx_movimientos_trabajador" ON "movimientos_trabajador"("trabajador_id");

-- CreateIndex
CREATE INDEX "idx_movimientos_tipo" ON "movimientos_trabajador"("tipo_movimiento_id");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_hora_extra_vigente_desde_key" ON "tarifas_hora_extra"("vigente_desde");

-- CreateIndex
CREATE INDEX "idx_nominas_trabajador" ON "nominas_semanales"("trabajador_id");

-- CreateIndex
CREATE INDEX "idx_nominas_periodo" ON "nominas_semanales"("periodo_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "nominas_semanales_trabajador_id_periodo_inicio_key" ON "nominas_semanales"("trabajador_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "idx_audit_log_entidad" ON "audit_log"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_usuario" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "_SeccionEncargados_B_index" ON "_SeccionEncargados"("B");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones" ADD CONSTRAINT "secciones_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_diarias" ADD CONSTRAINT "asistencias_diarias_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_diarias" ADD CONSTRAINT "asistencias_diarias_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "secciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias_diarias" ADD CONSTRAINT "asistencias_diarias_terminal_origen_id_fkey" FOREIGN KEY ("terminal_origen_id") REFERENCES "terminales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_trabajador" ADD CONSTRAINT "movimientos_trabajador_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_trabajador" ADD CONSTRAINT "movimientos_trabajador_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominas_semanales" ADD CONSTRAINT "nominas_semanales_trabajador_id_fkey" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeccionEncargados" ADD CONSTRAINT "_SeccionEncargados_A_fkey" FOREIGN KEY ("A") REFERENCES "secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeccionEncargados" ADD CONSTRAINT "_SeccionEncargados_B_fkey" FOREIGN KEY ("B") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

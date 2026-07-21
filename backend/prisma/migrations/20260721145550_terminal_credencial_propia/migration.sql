-- AlterTable
ALTER TABLE "terminales" ADD COLUMN "username" TEXT NOT NULL,
ADD COLUMN "password_hash" TEXT NOT NULL,
ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "terminales_username_key" ON "terminales"("username");

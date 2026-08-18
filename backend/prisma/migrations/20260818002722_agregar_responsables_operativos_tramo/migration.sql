-- CreateTable
CREATE TABLE "_SeccionResponsablesTramo" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_SeccionResponsablesTramo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SeccionResponsablesTramo_B_index" ON "_SeccionResponsablesTramo"("B");

-- AddForeignKey
ALTER TABLE "_SeccionResponsablesTramo" ADD CONSTRAINT "_SeccionResponsablesTramo_A_fkey" FOREIGN KEY ("A") REFERENCES "secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeccionResponsablesTramo" ADD CONSTRAINT "_SeccionResponsablesTramo_B_fkey" FOREIGN KEY ("B") REFERENCES "trabajadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

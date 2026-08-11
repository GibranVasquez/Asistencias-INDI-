import { prisma } from "../src/utils/prisma";

const URL_E2E = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";

async function main(): Promise<void> {
  if (process.env.INTEGRATION_TEST_DB !== "1" || process.env.DATABASE_URL !== URL_E2E) {
    throw new Error("Inspección E2E abortada: no es la base local indi_test.");
  }
  const [trabajadores, nominas, auditorias] = await Promise.all([
    prisma.trabajador.findMany({
      select: { nombreCompleto: true, sueldoBase: true },
      orderBy: { nombreCompleto: "asc" },
    }),
    prisma.nominaSemanal.findMany({
      select: { trabajador: { select: { nombreCompleto: true } }, montoSueldo: true, totalAPagar: true },
    }),
    prisma.auditLog.count({ where: { accion: "aplicar_sueldo_masivo_seleccion" } }),
  ]);
  process.stdout.write(JSON.stringify({
    trabajadores: trabajadores.map((t) => ({ nombre: t.nombreCompleto, sueldo: t.sueldoBase?.toNumber() ?? null })),
    nominas: nominas.map((n) => ({ trabajador: n.trabajador.nombreCompleto, montoSueldo: n.montoSueldo.toNumber(), total: n.totalAPagar.toNumber() })),
    auditorias,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

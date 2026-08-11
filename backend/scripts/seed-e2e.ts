import bcrypt from "bcrypt";
import { RolUsuario } from "@prisma/client";
import { prisma } from "../src/utils/prisma";

const URL_E2E = "postgresql://indi_test:indi_test_only@127.0.0.1:55432/indi_test";
export const PASSWORD_E2E = "E2E-only-Password!42";

function exigirBaseE2E(): void {
  if (process.env.INTEGRATION_TEST_DB !== "1" || process.env.DATABASE_URL !== URL_E2E) {
    throw new Error("Seed E2E abortado: DATABASE_URL no es la base local indi_test esperada.");
  }
}

async function limpiar(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.asignacionDiaria.deleteMany(),
    prisma.nominaSemanal.deleteMany(),
    prisma.movimientoTrabajador.deleteMany(),
    prisma.asistenciaDiaria.deleteMany(),
    prisma.eventoNoReconciliado.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.tipoMovimiento.deleteMany(),
    prisma.tarifaHoraExtra.deleteMany(),
    prisma.terminal.deleteMany(),
    prisma.trabajador.deleteMany(),
    prisma.seccion.deleteMany(),
    prisma.horario.deleteMany(),
    prisma.obra.deleteMany(),
    prisma.categoriaTrabajador.deleteMany(),
  ]);
}

async function main(): Promise<void> {
  exigirBaseE2E();
  await limpiar();
  const passwordHash = await bcrypt.hash(PASSWORD_E2E, 4);
  const horario = await prisma.horario.create({
    data: {
      nombre: "Turno E2E",
      horaEntrada: new Date("1970-01-01T08:00:00Z"),
      horaSalida: new Date("1970-01-01T18:00:00Z"),
      toleranciaMinutos: 10,
    },
  });
  const obra = await prisma.obra.create({ data: { nombre: "Obra ficticia E2E" } });
  const seccion = await prisma.seccion.create({
    data: { nombre: "Frente ficticio E2E", obraId: obra.id, horarioId: horario.id },
  });
  await prisma.categoriaTrabajador.create({
    data: { nombre: "Categoría E2E", sueldoBaseDefault: 700, esDefault: true },
  });
  const trabajadores = await Promise.all([
    prisma.trabajador.create({ data: { nombreCompleto: "Ana Prueba E2E", categoria: "Categoría E2E", jefeInmediato: "Jefatura ficticia", sueldoBase: 700, fechaIngreso: new Date("2026-01-01T00:00:00Z") } }),
    prisma.trabajador.create({ data: { nombreCompleto: "Bruno Prueba E2E", categoria: "Categoría E2E", jefeInmediato: "Jefatura ficticia", sueldoBase: 700, fechaIngreso: new Date("2026-01-01T00:00:00Z") } }),
    prisma.trabajador.create({ data: { nombreCompleto: "Control Prueba E2E", categoria: "Otra categoría E2E", jefeInmediato: "Jefatura ficticia", sueldoBase: 800, fechaIngreso: new Date("2026-01-01T00:00:00Z") } }),
  ]);

  for (const rol of Object.values(RolUsuario)) {
    await prisma.usuario.create({
      data: {
        username: `e2e-${rol}`,
        passwordHash,
        rol,
        trabajadorId: rol === RolUsuario.trabajador ? trabajadores[2].id : null,
        seccionesAsignadas: rol === RolUsuario.encargado_seccion ? { connect: { id: seccion.id } } : undefined,
      },
    });
  }
  await prisma.terminal.create({
    data: {
      username: "e2e-terminal",
      passwordHash,
      tipo: "kiosco",
      ubicacion: "Ubicación ficticia E2E",
    },
  });
  await prisma.nominaSemanal.create({
    data: {
      trabajadorId: trabajadores[2].id,
      periodoInicio: new Date("2026-08-03T00:00:00Z"),
      periodoFin: new Date("2026-08-09T00:00:00Z"),
      diasLaborados: 5,
      montoSueldo: 500,
      horasExtra: 0,
      montoHorasExtra: 0,
      viaticosSemanal: 0,
      viaticosMensual: 0,
      infonavitDescuento: 0,
      descuentosVarios: 0,
      totalAPagar: 500,
    },
  });
  console.log("Seed E2E listo: cinco roles, tres trabajadores y una terminal ficticios.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

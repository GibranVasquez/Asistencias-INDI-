import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------
// ADVERTENCIA: la contraseña "1234" es SOLO para desarrollo/pruebas locales.
// NUNCA usar esta contraseña (ni un hash generado a partir de ella) en un
// ambiente de producción o con datos reales.
// ---------------------------------------------------------------------
const PASSWORD_DEV_INSEGURA = "1234";
const RONDAS_BCRYPT = 10;

const OBRA_NOMBRE = "Tren Golfo de México";
const SECCIONES = ["Topografía", "Terracerías", "Estructuras", "Pavimentos"];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface RegistroRoster {
  no: string;
  nombreCompleto: string;
  categoria: string;
  jefeInmediato: string;
  obra: string;
}

function cargarRoster(): RegistroRoster[] {
  const rutaArchivo = path.join(__dirname, "seed-data", "roster_enrolamiento_tren_golfo.json");
  const contenido = fs.readFileSync(rutaArchivo, "utf-8");
  return JSON.parse(contenido);
}

async function sembrarObraYSecciones() {
  let obra = await prisma.obra.findFirst({ where: { nombre: OBRA_NOMBRE } });
  if (!obra) {
    obra = await prisma.obra.create({ data: { nombre: OBRA_NOMBRE } });
  }
  console.log(`Obra lista: ${obra.nombre}`);

  const secciones: Record<string, string> = {};
  for (const nombre of SECCIONES) {
    const seccion = await prisma.seccion.upsert({
      where: { obraId_nombre: { obraId: obra.id, nombre } },
      update: {},
      create: { obraId: obra.id, nombre },
    });
    secciones[nombre] = seccion.id;
    console.log(`Seccion lista: ${nombre}`);
  }

  return { obra, secciones };
}

async function sembrarHorarioOficina() {
  // toleranciaMinutos: valor de arranque (10 min), sin confirmar por el
  // usuario todavia — ajustable despues via el catalogo de Horario (RH).
  const fechaBase = "1970-01-01T";
  const horario = await prisma.horario.upsert({
    where: { nombre: "Oficina" },
    update: {},
    create: {
      nombre: "Oficina",
      horaEntrada: new Date(`${fechaBase}08:00:00Z`),
      horaSalida: new Date(`${fechaBase}20:00:00Z`),
      toleranciaMinutos: 10,
      recesoInicio: new Date(`${fechaBase}14:00:00Z`),
      recesoFin: new Date(`${fechaBase}16:00:00Z`),
    },
  });
  console.log("Horario listo: Oficina (08:00-20:00, receso 14:00-16:00)");
  return horario;
}

// Todas las secciones sembradas hoy son de oficina/campo sin horario propio
// confirmado todavia — se les asigna "Oficina" como aproximacion hasta que
// RH confirme un horario de campo real y lo reasigne por seccion via API.
async function vincularSeccionesAHorario(seccionIds: string[], horarioId: string) {
  await prisma.seccion.updateMany({
    where: { id: { in: seccionIds } },
    data: { horarioId },
  });
  console.log(`Secciones vinculadas al horario "Oficina": ${seccionIds.length}`);
}

async function sembrarTiposMovimiento() {
  const tipos = [
    {
      nombre: "Incapacidad IMSS",
      cuentaComoDiaTrabajado: false,
      esInformativo: false,
      requiereAutorizacion: true,
    },
    {
      nombre: "Vacaciones",
      cuentaComoDiaTrabajado: true,
      esInformativo: false,
      requiereAutorizacion: true,
    },
    {
      nombre: "Permiso sin goce de sueldo",
      cuentaComoDiaTrabajado: false,
      esInformativo: false,
      requiereAutorizacion: true,
    },
    {
      nombre: "Suspensión",
      cuentaComoDiaTrabajado: false,
      esInformativo: false,
      requiereAutorizacion: true,
    },
    {
      nombre: "Cambio de categoría",
      cuentaComoDiaTrabajado: true,
      esInformativo: true,
      requiereAutorizacion: false,
    },
    {
      nombre: "Cambio de proyecto",
      cuentaComoDiaTrabajado: true,
      esInformativo: true,
      requiereAutorizacion: false,
    },
  ];

  for (const tipo of tipos) {
    await prisma.tipoMovimiento.upsert({
      where: { nombre: tipo.nombre },
      update: {},
      create: tipo,
    });
  }
  console.log(`Catalogo de TipoMovimiento listo (${tipos.length} tipos)`);
}

async function sembrarTrabajadores(roster: RegistroRoster[]) {
  let creados = 0;
  let existentes = 0;

  for (const registro of roster) {
    const existente = await prisma.trabajador.findFirst({
      where: { nombreCompleto: registro.nombreCompleto },
    });
    if (existente) {
      existentes++;
      continue;
    }
    await prisma.trabajador.create({
      data: {
        nombreCompleto: registro.nombreCompleto,
        categoria: registro.categoria,
        jefeInmediato: registro.jefeInmediato,
      },
    });
    creados++;
  }

  console.log(`Trabajadores del roster: ${creados} creados, ${existentes} ya existian`);
}

interface CuentaSemilla {
  username: string;
  password: string;
  rol: "administrador" | "rh" | "recepcion" | "encargado_seccion";
  seccionesAsignadas?: string[];
}

async function sembrarUsuarios(secciones: Record<string, string>) {
  const adminUsername = process.env.ADMIN_SEED_USERNAME;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminUsername || !adminPassword) {
    throw new Error(
      "ADMIN_SEED_USERNAME y ADMIN_SEED_PASSWORD son requeridos para sembrar la cuenta de administrador (ver .env.example)."
    );
  }

  const cuentas: CuentaSemilla[] = [
    { username: adminUsername, password: adminPassword, rol: "administrador" },
    { username: "rh1", password: PASSWORD_DEV_INSEGURA, rol: "rh" },
    { username: "recepcion1", password: PASSWORD_DEV_INSEGURA, rol: "recepcion" },
    {
      username: "encargado_topografia",
      password: PASSWORD_DEV_INSEGURA,
      rol: "encargado_seccion",
      seccionesAsignadas: ["Topografía"],
    },
  ];

  for (const cuenta of cuentas) {
    const passwordHash = await bcrypt.hash(cuenta.password, RONDAS_BCRYPT);
    const seccionesConnect = (cuenta.seccionesAsignadas ?? []).map((nombre) => ({
      id: secciones[nombre],
    }));

    await prisma.usuario.upsert({
      where: { username: cuenta.username },
      update: {
        passwordHash,
        rol: cuenta.rol,
        activo: true,
        seccionesAsignadas: { set: seccionesConnect },
      },
      create: {
        username: cuenta.username,
        passwordHash,
        rol: cuenta.rol,
        seccionesAsignadas: { connect: seccionesConnect },
      },
    });
    console.log(`Usuario listo: ${cuenta.username} (${cuenta.rol})`);
  }
}

async function main() {
  const roster = cargarRoster();
  console.log(`Roster cargado: ${roster.length} registros`);

  const { secciones } = await sembrarObraYSecciones();
  const horarioOficina = await sembrarHorarioOficina();
  await vincularSeccionesAHorario(Object.values(secciones), horarioOficina.id);
  await sembrarTiposMovimiento();
  await sembrarTrabajadores(roster);
  await sembrarUsuarios(secciones);

  console.log(
    "\nNOTA: TarifaHoraExtra no se sembro (no hay un valor real todavia) — " +
      "RH debe darlo de alta antes de generar la primera nomina con horas extra."
  );
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

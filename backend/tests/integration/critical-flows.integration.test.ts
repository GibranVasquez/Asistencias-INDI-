import { once } from "node:events";
import { PassThrough } from "node:stream";
import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { MetodoAsistencia, RolUsuario, TrabajadorEstatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { corregirNominaSemanal, generarNominaSemanal } from "../../src/services/nomina.service";
import { obtenerReporteNomina } from "../../src/services/reporteNomina.service";
import { generarExcelNomina, generarPdfNomina } from "../../src/utils/exportadores/nominaExport";
import { prisma } from "../../src/utils/prisma";

const PASSWORD = "Test-password-123";
const FECHA = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HORA = (hora: string) => new Date(`1970-01-01T${hora}Z`);

async function limpiarBase(): Promise<void> {
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

async function escenarioBase() {
  const [passwordHash, obra] = await Promise.all([
    bcrypt.hash(PASSWORD, 4),
    prisma.obra.create({ data: { nombre: "Obra integración" } }),
  ]);
  const seccion = await prisma.seccion.create({ data: { nombre: "Oficina", obraId: obra.id } });
  const terminal = await prisma.terminal.create({
    data: {
      username: "kiosco-test",
      passwordHash,
      tipo: "kiosco",
      ubicacion: "Local test",
    },
  });
  const adms = await prisma.terminal.create({
    data: {
      username: "adms-test",
      passwordHash,
      tipo: "adms",
      ubicacion: "Local test",
      numeroSerie: "SN-INTEGRATION-1",
    },
  });
  const trabajadores = await Promise.all([
    prisma.trabajador.create({ data: { nombreCompleto: "Trabajador A", categoria: "Operación", jefeInmediato: "Jefe", sueldoBase: 700, numeroChecador: 101 } }),
    prisma.trabajador.create({ data: { nombreCompleto: "Trabajador B", categoria: "Operación", jefeInmediato: "Jefe", sueldoBase: 700, numeroChecador: 102 } }),
  ]);
  const usuarios = new Map<RolUsuario, Awaited<ReturnType<typeof prisma.usuario.create>>>();
  for (const rol of Object.values(RolUsuario)) {
    const usuario = await prisma.usuario.create({
      data: { username: `test-${rol}`, passwordHash, rol, trabajadorId: rol === RolUsuario.trabajador ? trabajadores[0].id : null },
    });
    usuarios.set(rol, usuario);
  }
  return { seccion, terminal, adms, trabajadores, usuarios };
}

async function tokenHumano(rol: RolUsuario): Promise<string> {
  const respuesta = await request(app).post("/auth/login").send({ username: `test-${rol}`, password: PASSWORD });
  expect(respuesta.status).toBe(200);
  return respuesta.body.token as string;
}

async function tokenTerminal(): Promise<string> {
  const respuesta = await request(app).post("/auth/login-terminal").send({ username: "kiosco-test", password: PASSWORD });
  expect(respuesta.status).toBe(200);
  return respuesta.body.token as string;
}

beforeEach(limpiarBase);
afterAll(async () => {
  await limpiarBase();
  await prisma.$disconnect();
});

describe("PostgreSQL real: nómina y snapshots", () => {
  it("integra asistencia, movimientos, tarifa, montos y conserva el snapshot", async () => {
    const { seccion, terminal, trabajadores, usuarios } = await escenarioBase();
    const trabajador = trabajadores[0];
    for (const dia of ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]) {
      await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA(dia), hora: HORA("08:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella } });
    }
    const [cuenta, noCuenta] = await Promise.all([
      prisma.tipoMovimiento.create({ data: { nombre: "Permiso con goce", cuentaComoDiaTrabajado: true, esInformativo: false, requiereAutorizacion: false } }),
      prisma.tipoMovimiento.create({ data: { nombre: "Falta", cuentaComoDiaTrabajado: false, esInformativo: false, requiereAutorizacion: false } }),
    ]);
    await prisma.movimientoTrabajador.createMany({ data: [
      { trabajadorId: trabajador.id, tipoMovimientoId: cuenta.id, fechaInicio: FECHA("2026-08-07"), fechaFin: FECHA("2026-08-08") },
      { trabajadorId: trabajador.id, tipoMovimientoId: noCuenta.id, fechaInicio: FECHA("2026-08-09"), fechaFin: FECHA("2026-08-09") },
    ] });
    await prisma.tarifaHoraExtra.create({ data: { valor: 100, vigenteDesde: FECHA("2026-01-01") } });

    const nomina = await generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajador.id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 2,
      viaticosSemanal: 50, viaticosMensual: 0, descuentosVarios: 25,
    });
    expect(nomina.diasLaborados.toNumber()).toBe(6);
    expect(nomina.montoSueldo.toNumber()).toBe(600);
    expect(nomina.montoHorasExtra.toNumber()).toBe(200);
    expect(nomina.totalAPagar.toNumber()).toBe(825);

    await prisma.trabajador.update({ where: { id: trabajador.id }, data: { sueldoBase: 1400, categoria: "Categoría cambiada" } });
    await prisma.tarifaHoraExtra.update({ where: { vigenteDesde: FECHA("2026-01-01") }, data: { valor: 999 } });
    const historica = await prisma.nominaSemanal.findUniqueOrThrow({ where: { id: nomina.id } });
    expect({ sueldo: historica.montoSueldo.toNumber(), extra: historica.montoHorasExtra.toNumber(), total: historica.totalAPagar.toNumber() })
      .toEqual({ sueldo: 600, extra: 200, total: 825 });
  });

  it("rechaza un total negativo sin persistir nómina ni auditoría", async () => {
    const { trabajadores, usuarios } = await escenarioBase();
    await expect(generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajadores[0].id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 0,
      viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 1,
    })).rejects.toMatchObject({ status: 400 });
    expect(await prisma.nominaSemanal.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { accion: "crear_nomina" } })).toBe(0);
  });

  it("congela decimales de sueldo, tarifa y conceptos en la escala monetaria real", async () => {
    const { seccion, terminal, trabajadores, usuarios } = await escenarioBase();
    const trabajador = trabajadores[0];
    await prisma.trabajador.update({ where: { id: trabajador.id }, data: { sueldoBase: 100.1 } });
    for (let dia = 3; dia <= 9; dia++) {
      await prisma.asistenciaDiaria.create({
        data: {
          trabajadorId: trabajador.id,
          terminalOrigenId: terminal.id,
          seccionId: seccion.id,
          fecha: FECHA(`2026-08-${String(dia).padStart(2, "0")}`),
          hora: HORA("08:00:00"),
          turno: "Día",
          metodoUsado: MetodoAsistencia.huella,
        },
      });
    }
    await prisma.tarifaHoraExtra.create({ data: { valor: 33.3, vigenteDesde: FECHA("2026-01-01") } });

    const nomina = await generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajador.id, {
      periodoInicio: "2026-08-03",
      periodoFin: "2026-08-09",
      horasExtra: 0.3,
      viaticosSemanal: 0.1,
      viaticosMensual: 0,
      descuentosVarios: 0.2,
    });

    expect(nomina.montoSueldo.toFixed(2)).toBe("100.10");
    expect(nomina.montoHorasExtra.toFixed(2)).toBe("9.99");
    expect(nomina.viaticosSemanal.toFixed(2)).toBe("0.10");
    expect(nomina.descuentosVarios.toFixed(2)).toBe("0.20");
    expect(nomina.totalAPagar.toFixed(2)).toBe("109.99");
    expect(Number.isFinite(nomina.totalAPagar.toNumber())).toBe(true);
  });

  it("corrige una nómina, conserva periodo/trabajador y registra la auditoría", async () => {
    const { seccion, terminal, trabajadores, usuarios } = await escenarioBase();
    const trabajador = trabajadores[0];
    for (const dia of ["2026-08-03", "2026-08-04", "2026-08-05"]) {
      await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA(dia), hora: HORA("08:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella } });
    }
    await prisma.tarifaHoraExtra.create({ data: { valor: 100, vigenteDesde: FECHA("2026-01-01") } });
    const original = await generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajador.id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0,
    });
    const creadoEn = original.creadoEn;

    const corregida = await corregirNominaSemanal(usuarios.get(RolUsuario.rh)!.id, original.id, {
      horasExtra: 2, viaticosSemanal: 50, viaticosMensual: 0, descuentosVarios: 25,
    });

    expect(corregida.trabajadorId).toBe(trabajador.id);
    expect(corregida.periodoInicio).toEqual(original.periodoInicio);
    expect(corregida.periodoFin).toEqual(original.periodoFin);
    expect(corregida.creadoEn).toEqual(creadoEn);
    expect(corregida.diasLaborados.toNumber()).toBe(3);
    expect(corregida.montoSueldo.toFixed(2)).toBe("300.00");
    expect(corregida.montoHorasExtra.toFixed(2)).toBe("200.00");
    expect(corregida.totalAPagar.toFixed(2)).toBe("525.00");
    expect(await prisma.auditLog.count({ where: { accion: "corregir_nomina", entidadId: original.id } })).toBe(1);
  });

  it("permite correcciones sucesivas y conserva el resultado de la última", async () => {
    const { trabajadores, usuarios } = await escenarioBase();
    const original = await generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajadores[0].id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0,
    });
    await corregirNominaSemanal(usuarios.get(RolUsuario.rh)!.id, original.id, { horasExtra: 0, viaticosSemanal: 10, viaticosMensual: 0, descuentosVarios: 0 });
    const ultima = await corregirNominaSemanal(usuarios.get(RolUsuario.rh)!.id, original.id, { horasExtra: 0, viaticosSemanal: 25, viaticosMensual: 0, descuentosVarios: 0 });

    expect(ultima.viaticosSemanal.toFixed(2)).toBe("25.00");
    expect(ultima.totalAPagar.toFixed(2)).toBe("25.00");
    expect(await prisma.auditLog.count({ where: { accion: "corregir_nomina", entidadId: original.id } })).toBe(2);
  });
});

describe("HTTP real: autenticación, roles y sueldo masivo", () => {
  it("mantiene la nómina histórica al aplicar un sueldo nuevo al trabajador", async () => {
    const { seccion, terminal, trabajadores, usuarios } = await escenarioBase();
    const trabajador = trabajadores[0];
    await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA("2026-08-03"), hora: HORA("08:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella } });
    const usuarioRh = usuarios.get(RolUsuario.rh)!;
    const historica = await generarNominaSemanal(usuarioRh.id, trabajador.id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0,
    });
    const token = await tokenHumano(RolUsuario.rh);
    const respuesta = await request(app).post("/trabajadores/aplicar-sueldo").set("Authorization", `Bearer ${token}`).send({ ids: [trabajador.id], nuevoSueldoBase: 1400 });
    expect(respuesta.status).toBe(200);
    const nominaConsultada = await prisma.nominaSemanal.findUniqueOrThrow({ where: { id: historica.id } });
    expect(nominaConsultada.montoSueldo.toFixed(2)).toBe("100.00");
    expect((await prisma.trabajador.findUniqueOrThrow({ where: { id: trabajador.id } })).sueldoBase?.toFixed(2)).toBe("1400.00");
  });

  it("distingue login válido, credenciales genéricas, cuenta inactiva y JWT expirado", async () => {
    const { usuarios } = await escenarioBase();
    const ok = await request(app).post("/auth/login").send({ username: "test-rh", password: PASSWORD });
    expect(ok.status).toBe(200);
    for (const credenciales of [
      { username: "test-rh", password: "incorrecta" },
      { username: "no-existe", password: "incorrecta" },
    ]) {
      const res = await request(app).post("/auth/login").send(credenciales);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Usuario o contraseña incorrectos.");
    }
    await prisma.usuario.update({ where: { id: usuarios.get(RolUsuario.recepcion)!.id }, data: { activo: false } });
    expect((await request(app).post("/auth/login").send({ username: "test-recepcion", password: PASSWORD })).status).toBe(403);
    const expirado = jwt.sign({ usuarioId: usuarios.get(RolUsuario.rh)!.id, rol: RolUsuario.rh, trabajadorId: null }, process.env.JWT_SECRET!, { expiresIn: -1 });
    expect((await request(app).get("/trabajadores").set("Authorization", `Bearer ${expirado}`)).status).toBe(401);
  });

  it("actualiza solo seleccionados y revierte sueldo y auditoría ante un inactivo", async () => {
    const { trabajadores } = await escenarioBase();
    const token = await tokenHumano(RolUsuario.rh);
    const valido = await request(app).post("/trabajadores/aplicar-sueldo").set("Authorization", `Bearer ${token}`)
      .send({ ids: [trabajadores[0].id, trabajadores[1].id, trabajadores[0].id], nuevoSueldoBase: 900.5 });
    expect(valido.status).toBe(200);
    expect(valido.body.afectados).toBe(2);
    expect((await prisma.trabajador.findMany({ orderBy: { nombreCompleto: "asc" } })).map((t) => t.sueldoBase?.toNumber())).toEqual([900.5, 900.5]);
    expect(await prisma.auditLog.count({ where: { accion: "aplicar_sueldo_masivo_seleccion" } })).toBe(2);

    await prisma.trabajador.update({ where: { id: trabajadores[1].id }, data: { estatus: TrabajadorEstatus.baja } });
    const auditoriasAntes = await prisma.auditLog.count();
    const rollback = await request(app).post("/trabajadores/aplicar-sueldo").set("Authorization", `Bearer ${token}`)
      .send({ ids: trabajadores.map((t) => t.id), nuevoSueldoBase: 1200 });
    expect(rollback.status).toBe(400);
    expect((await prisma.trabajador.findUniqueOrThrow({ where: { id: trabajadores[0].id } })).sueldoBase?.toNumber()).toBe(900.5);
    expect(await prisma.auditLog.count()).toBe(auditoriasAntes);
  });

  it("aplica la matriz actual: solo RH ve finanzas y los tipos de token no se intercambian", async () => {
    const { usuarios } = await escenarioBase();
    const [rh, admin, recepcion, encargado, terminal, trabajadorRechazado] = await Promise.all([
      tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.recepcion),
      tokenHumano(RolUsuario.encargado_seccion), tokenTerminal(),
      request(app).post("/auth/login").send({ username: "test-trabajador", password: PASSWORD }),
    ]);
    expect(trabajadorRechazado.status).toBe(403);
    const trabajador = jwt.sign({
      usuarioId: usuarios.get(RolUsuario.trabajador)!.id,
      rol: RolUsuario.trabajador,
      trabajadorId: usuarios.get(RolUsuario.trabajador)!.trabajadorId,
    }, process.env.JWT_SECRET!, { expiresIn: "5m" });
    expect((await request(app).get("/nominas").set("Authorization", `Bearer ${rh}`)).status).toBe(200);
    for (const token of [admin, recepcion, encargado, trabajador, terminal]) {
      const res = await request(app).get("/nominas").set("Authorization", `Bearer ${token}`);
      expect([401, 403]).toContain(res.status);
    }
    expect((await request(app).get("/terminales").set("Authorization", `Bearer ${terminal}`)).status).toBe(401);
    expect((await request(app).post("/asistencias").set("Authorization", `Bearer ${rh}`).send({})).status).toBe(401);
    expect((await request(app).get("/trabajadores")).status).toBe(401);
    expect((await request(app).get("/trabajadores").set("Authorization", "Bearer inválido")).status).toBe(401);
  });
});

describe("HTTP real: configuración de la obra", () => {
  it("permite consultar a RH y Administrador, pero solo Administrador puede modificar", async () => {
    const { usuarios } = await escenarioBase();
    const [tokenRh, tokenAdministrador] = await Promise.all([
      tokenHumano(RolUsuario.rh),
      tokenHumano(RolUsuario.administrador),
    ]);

    expect((await request(app).get("/obras/actual").set("Authorization", `Bearer ${tokenRh}`)).status).toBe(200);
    expect((await request(app).get("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`)).status).toBe(200);
    expect((await request(app).patch("/obras/actual").set("Authorization", `Bearer ${tokenRh}`).send({ nombre: "No permitido" })).status).toBe(403);
    const actualizada = await request(app).patch("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`).send({ nombre: "Obra integración actualizada" });
    expect(actualizada.status).toBe(200);
    expect(actualizada.body.obra.nombre).toBe("Obra integración actualizada");
    expect(await prisma.auditLog.count({ where: { accion: "editar_obra", usuarioId: usuarios.get(RolUsuario.administrador)!.id } })).toBe(1);
  });
});

describe("HTTP real: responsables operativos del tramo", () => {
  it("permite a RH y Administrador asignar, consultar y retirar trabajadores activos con auditoría", async () => {
    const { seccion, trabajadores, usuarios } = await escenarioBase();
    const [tokenRh, tokenAdmin, tokenRecepcion, tokenEncargado] = await Promise.all([
      tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.recepcion), tokenHumano(RolUsuario.encargado_seccion),
    ]);

    // El listado que consume Configuración → Frentes incluye ambas relaciones
    // (cuentas técnicas y responsables operativos); con el esquema efímero
    // completo debe responder sin el 500 genérico observado con bases locales
    // que aún no tenían las migraciones recientes.
    const listadoSecciones = await request(app).get("/secciones").set("Authorization", `Bearer ${tokenRh}`);
    expect(listadoSecciones.status).toBe(200);
    expect(listadoSecciones.body.secciones[0]).toMatchObject({ id: seccion.id, responsablesTramo: [] });

    const elegibles = await request(app).get("/secciones/responsables/elegibles").set("Authorization", `Bearer ${tokenRh}`);
    expect(elegibles.status).toBe(200);
    expect(elegibles.body.trabajadores).toHaveLength(2);
    expect(elegibles.body.trabajadores[0]).not.toHaveProperty("sueldoBase");

    const asignado = await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id });
    expect(asignado.status).toBe(201);
    expect(asignado.body.responsable).toMatchObject({ id: trabajadores[0].id, nombreCompleto: "Trabajador A", estatus: "activo" });

    const duplicado = await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id });
    expect(duplicado.status).toBe(409);
    const segundo = await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenAdmin}`).send({ trabajadorId: trabajadores[1].id });
    expect(segundo.status).toBe(201);

    for (const token of [tokenRecepcion, tokenEncargado]) {
      expect((await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${token}`).send({ trabajadorId: trabajadores[0].id })).status).toBe(403);
    }

    await prisma.trabajador.update({ where: { id: trabajadores[1].id }, data: { estatus: TrabajadorEstatus.baja } });
    const inactivo = await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[1].id });
    expect(inactivo.status).toBe(400);
    const elegiblesTrasBaja = await request(app).get("/secciones/responsables/elegibles").set("Authorization", `Bearer ${tokenRh}`);
    expect(elegiblesTrasBaja.body.trabajadores.map((trabajador: { id: string }) => trabajador.id)).not.toContain(trabajadores[1].id);
    expect((await request(app).post(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: "00000000-0000-4000-8000-000000000000" })).status).toBe(404);
    expect((await request(app).post("/secciones/00000000-0000-4000-8000-000000000000/responsables").set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id })).status).toBe(404);

    const listado = await request(app).get(`/secciones/${seccion.id}/responsables`).set("Authorization", `Bearer ${tokenRh}`);
    expect(listado.body.responsablesTramo.map((responsable: { id: string }) => responsable.id)).toEqual([trabajadores[0].id, trabajadores[1].id]);
    expect(await prisma.auditLog.count({ where: { accion: "responsable_tramo_asignado" } })).toBe(2);

    const retirado = await request(app).delete(`/secciones/${seccion.id}/responsables/${trabajadores[0].id}`).set("Authorization", `Bearer ${tokenRh}`);
    expect(retirado.status).toBe(204);
    expect((await request(app).delete(`/secciones/${seccion.id}/responsables/${trabajadores[0].id}`).set("Authorization", `Bearer ${tokenRh}`)).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { accion: "responsable_tramo_retirado", usuarioId: usuarios.get(RolUsuario.rh)!.id } })).toBe(1);
  });
});

describe("PostgreSQL real: congelamiento central de escrituras", () => {
  it("bloquea flujos humanos, Terminal y ADMS sin cambiar datos ni auditoría", async () => {
    const { seccion, terminal, trabajadores } = await escenarioBase();
    const [tokenRh, tokenKiosco] = await Promise.all([tokenHumano(RolUsuario.rh), tokenTerminal()]);
    const snapshot = async () => ({
      trabajadores: await prisma.trabajador.findMany({ orderBy: { id: "asc" } }),
      usuarios: await prisma.usuario.findMany({ orderBy: { id: "asc" } }),
      asistencias: await prisma.asistenciaDiaria.findMany({ orderBy: { id: "asc" } }),
      nominas: await prisma.nominaSemanal.findMany({ orderBy: { id: "asc" } }),
      eventos: await prisma.eventoNoReconciliado.findMany({ orderBy: { id: "asc" } }),
      auditoria: await prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
      terminales: await prisma.terminal.findMany({ orderBy: { id: "asc" } }),
    });
    const antes = await snapshot();
    process.env.MAINTENANCE_MODE = "true";
    try {
      const intentos = await Promise.all([
        request(app).post("/asistencias").set("Authorization", `Bearer ${tokenKiosco}`).send({ trabajadorId: trabajadores[0].id, fecha: "2026-08-03", hora: "08:00:00", seccionId: seccion.id, turno: "Día", metodoUsado: "huella" }),
        request(app).post("/trabajadores/aplicar-sueldo").set("Authorization", `Bearer ${tokenRh}`).send({ ids: trabajadores.map(t=>t.id), nuevoSueldoBase: 999 }),
        request(app).post("/usuarios").set("Authorization", `Bearer ${tokenRh}`).send({ username:"bloqueado", password:"Ficticia-123", rol:"rh" }),
        request(app).post("/nominas").set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id, periodoInicio:"2026-08-03", periodoFin:"2026-08-09", horasExtra:0, viaticosSemanal:0, viaticosMensual:0, descuentosVarios:0 }),
        request(app).get("/iclock/cdata?SN=SN-INTEGRATION-1&options=all"),
        request(app).post("/iclock/cdata?SN=SN-INTEGRATION-1&table=ATTLOG").type("text/plain").send("101\t2026-08-03 08:00:00\t0\t1"),
      ]);
      for (const respuesta of intentos) {
        expect(respuesta.status).toBe(503);
        expect(respuesta.body).toEqual({ error:"MAINTENANCE_MODE", message:"El sistema se encuentra temporalmente en mantenimiento." });
      }
      const health = await request(app).get("/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok", maintenance: true });
      expect((await request(app).post("/auth/login").send({ username:"test-rh", password:PASSWORD })).status).toBe(503);
      expect(await snapshot()).toEqual(antes);
      expect(antes.terminales.find(t=>t.id===terminal.id)?.ultimaSincronizacion).toBeNull();
    } finally { delete process.env.MAINTENANCE_MODE; }

    expect((await request(app).get("/health")).body).toEqual({ status: "ok", maintenance: false });

    const normal = await request(app).post("/asistencias").set("Authorization", `Bearer ${tokenKiosco}`).send({ trabajadorId: trabajadores[0].id, fecha: "2026-08-03", hora: "08:00:00", seccionId: seccion.id, turno: "Día", metodoUsado: "huella" });
    expect(normal.status).toBe(201);
    expect(await prisma.asistenciaDiaria.count()).toBe(1);
  });
});

describe("PostgreSQL/HTTP real: asistencia y ADMS", () => {
  it("hace idempotente el duplicado exacto pero conserva entrada y salida", async () => {
    const { seccion, trabajadores } = await escenarioBase();
    const token = await tokenTerminal();
    const datos = { trabajadorId: trabajadores[0].id, fecha: "2026-08-03", hora: "08:00", seccionId: seccion.id, turno: "Día", metodoUsado: "huella" };
    const [primera, repetida] = await Promise.all([
      request(app).post("/asistencias").set("Authorization", `Bearer ${token}`).send(datos),
      request(app).post("/asistencias").set("Authorization", `Bearer ${token}`).send(datos),
    ]);
    expect(primera.status).toBe(201);
    expect(repetida.status).toBe(201);
    expect(primera.body.asistencia.id).toBe(repetida.body.asistencia.id);
    const salida = await request(app).post("/asistencias").set("Authorization", `Bearer ${token}`).send({ ...datos, hora: "18:00" });
    expect(salida.status).toBe(201);
    expect(await prisma.asistenciaDiaria.count()).toBe(2);
    expect((await prisma.asistenciaDiaria.findFirstOrThrow({ where: { id: salida.body.asistencia.id } })).seccionId).toBe(seccion.id);
  });

  it("procesa ATTLOG conocido, conserva desconocido y deduplica ambos por HTTP", async () => {
    const { trabajadores } = await escenarioBase();
    const cuerpo = "101\t2026-08-03 08:01:02\t0\t1\n999\t2026-08-03 08:02:03\t0\t15";
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/iclock/cdata?SN=SN-INTEGRATION-1&table=ATTLOG").set("Content-Type", "text/plain").send(cuerpo);
      expect(res.status).toBe(200);
      expect(res.text).toBe("OK");
    }
    expect(await prisma.asistenciaDiaria.count({ where: { trabajadorId: trabajadores[0].id } })).toBe(1);
    expect(await prisma.eventoNoReconciliado.count({ where: { pinDispositivo: "999" } })).toBe(1);
    expect(await prisma.trabajador.count()).toBe(2);
    expect((await request(app).get("/iclock/cdata?SN=SN-FALSO")).status).toBe(403);
  });
});

describe("exportaciones integradas desde PostgreSQL", () => {
  it("genera XLSX y PDF válidos desde una nómina persistida y neutraliza categoría maliciosa", async () => {
    const { trabajadores } = await escenarioBase();
    await prisma.trabajador.update({ where: { id: trabajadores[0].id }, data: { categoria: "=1+1" } });
    await prisma.nominaSemanal.create({ data: {
      trabajadorId: trabajadores[0].id, periodoInicio: FECHA("2026-08-03"), periodoFin: FECHA("2026-08-09"),
      diasLaborados: 5, montoSueldo: 500, horasExtra: 2, montoHorasExtra: 200, viaticosSemanal: 50,
      viaticosMensual: 0, infonavitDescuento: 10, descuentosVarios: 25, totalAPagar: 715,
    } });
    const reporte = await obtenerReporteNomina("2026-08-03", "2026-08-09");
    expect(reporte.resumen).toMatchObject({ totalPagado: "715.00", totalHorasExtra: "200.00", cantidadNominas: 1 });
    const xlsx = await generarExcelNomina(reporte);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(xlsx);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Por categoría", "Por periodo"]);
    expect(libro.getWorksheet("Por categoría")?.getCell("A2").value).toBe("'=1+1");

    const salida = new PassThrough();
    const trozos: Buffer[] = [];
    salida.on("data", (trozo) => trozos.push(Buffer.from(trozo)));
    generarPdfNomina(reporte, salida);
    await once(salida, "end");
    const pdf = Buffer.concat(trozos);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});

describe("PostgreSQL/HTTP real: supervisión empresarial", () => {
  it("expone incidencias reales solo a roles autorizados", async () => {
    const { adms } = await escenarioBase();
    await prisma.eventoNoReconciliado.create({ data: { terminalId: adms.id, pinDispositivo: "PIN-FICTICIO", marcadoEn: new Date("2026-08-14T10:00:00Z"), metodoCrudo: "1" } });
    const [tokenRh, tokenAdmin, tokenRecepcion] = await Promise.all([tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.recepcion)]);
    for (const token of [tokenRh, tokenAdmin]) {
      const respuesta = await request(app).get("/incidencias?limite=10").set("Authorization", `Bearer ${token}`);
      expect(respuesta.status).toBe(200); expect(respuesta.body.total).toBe(1);
      expect(respuesta.body.items[0]).toMatchObject({ tipo: "ADMS_NO_RECONCILIADO", identificadorDispositivo: "PIN-FICTICIO" });
      expect(JSON.stringify(respuesta.body)).not.toMatch(/password|token|hash/i);
    }
    expect((await request(app).get("/incidencias").set("Authorization", `Bearer ${tokenRecepcion}`)).status).toBe(403);
  });

  it("pagina auditoría, restringe acceso y sanitiza metadata", async () => {
    const { usuarios } = await escenarioBase(); const admin = usuarios.get(RolUsuario.administrador)!;
    await prisma.auditLog.create({ data: { usuarioId: admin.id, accion: "resetear_password", entidad: "Usuario", entidadId: admin.id, detalle: { username: "test-administrador", password: "NO-MOSTRAR", token: "NO-MOSTRAR" } } });
    const [tokenAdmin, tokenRh] = await Promise.all([tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.rh)]);
    const respuesta = await request(app).get("/auditoria?pagina=1&limite=10").set("Authorization", `Bearer ${tokenAdmin}`);
    expect(respuesta.status).toBe(200); expect(respuesta.body).toMatchObject({ total: 1, pagina: 1, limite: 10 });
    expect(respuesta.body.registros[0].detalle).toEqual(["username: test-administrador"]);
    expect(JSON.stringify(respuesta.body)).not.toContain("NO-MOSTRAR");
    expect((await request(app).get("/auditoria").set("Authorization", `Bearer ${tokenRh}`)).status).toBe(403);
    expect((await request(app).get("/auditoria?limite=500").set("Authorization", `Bearer ${tokenAdmin}`)).status).toBe(400);
  });
});

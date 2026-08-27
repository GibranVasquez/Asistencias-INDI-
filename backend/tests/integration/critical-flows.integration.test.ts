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
import { obtenerHistoricoTrabajador, obtenerReporteAsistencia } from "../../src/services/reporteAsistencia.service";
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
      obraId: obra.id,
    },
  });
  const adms = await prisma.terminal.create({
    data: {
      username: "adms-test",
      passwordHash,
      tipo: "adms",
      ubicacion: "Local test",
      numeroSerie: "SN-INTEGRATION-1",
      obraId: obra.id,
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

  it("conserva la corrección con sueldo y tarifa vigentes al momento de corregir", async () => {
    const { seccion, terminal, trabajadores, usuarios } = await escenarioBase();
    const trabajador = trabajadores[0];
    await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajador.id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA("2026-08-03"), hora: HORA("08:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella } });
    await prisma.tarifaHoraExtra.create({ data: { valor: 100, vigenteDesde: FECHA("2026-01-01") } });
    const original = await generarNominaSemanal(usuarios.get(RolUsuario.rh)!.id, trabajador.id, {
      periodoInicio: "2026-08-03", periodoFin: "2026-08-09", horasExtra: 0, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0,
    });

    await prisma.trabajador.update({ where: { id: trabajador.id }, data: { sueldoBase: 1400 } });
    await prisma.tarifaHoraExtra.create({ data: { valor: 200, vigenteDesde: FECHA("2026-08-01") } });
    const corregida = await corregirNominaSemanal(usuarios.get(RolUsuario.rh)!.id, original.id, {
      horasExtra: 1, viaticosSemanal: 0, viaticosMensual: 0, descuentosVarios: 0,
    });

    expect(corregida.montoSueldo.toFixed(2)).toBe("200.00");
    expect(corregida.montoHorasExtra.toFixed(2)).toBe("200.00");
    expect(corregida.totalAPagar.toFixed(2)).toBe("400.00");
  });
});

describe("PostgreSQL real: analítica de asistencia", () => {
  it("caracteriza el límite inclusivo de puntualidad y los días hábiles", async () => {
    const { seccion, trabajadores } = await escenarioBase();
    const horario = await prisma.horario.create({ data: { nombre: "Turno analítico", horaEntrada: HORA("08:00:00"), horaSalida: HORA("17:00:00"), toleranciaMinutos: 10 } });
    await prisma.seccion.update({ where: { id: seccion.id }, data: { horarioId: horario.id } });
    for (const [trabajador, fecha, hora] of [
      [trabajadores[0], "2026-08-03", "08:09:00"],
      [trabajadores[1], "2026-08-04", "08:10:00"],
      [trabajadores[0], "2026-08-05", "08:11:00"],
    ] as const) {
      await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajador.id, terminalOrigenId: (await prisma.terminal.findFirstOrThrow()).id, seccionId: seccion.id, fecha: FECHA(fecha), hora: HORA(hora), turno: "Día", metodoUsado: MetodoAsistencia.huella } });
    }
    const reporte = await obtenerReporteAsistencia("2026-08-03", "2026-08-07");
    expect(reporte.resumen).toMatchObject({ presentes: 3, aTiempo: 2, tardanzas: 1, ausentes: 7, diasHabiles: 5, porcentajePuntualidad: 67 });
  });

  it("clasifica después del límite, separa frentes y conserva periodos vacíos", async () => {
    const { seccion, terminal, trabajadores } = await escenarioBase();
    const horarioA = await prisma.horario.create({ data: { nombre: "Turno A", horaEntrada: HORA("08:00:00"), horaSalida: HORA("17:00:00"), toleranciaMinutos: 10 } });
    const horarioB = await prisma.horario.create({ data: { nombre: "Turno B", horaEntrada: HORA("09:00:00"), horaSalida: HORA("18:00:00"), toleranciaMinutos: 0 } });
    const seccionB = await prisma.seccion.create({ data: { nombre: "Frente B", obraId: seccion.obraId, horarioId: horarioB.id } });
    await prisma.seccion.update({ where: { id: seccion.id }, data: { horarioId: horarioA.id } });
    await prisma.asistenciaDiaria.createMany({ data: [
      { trabajadorId: trabajadores[0].id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA("2026-08-05"), hora: HORA("08:11:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella },
      { trabajadorId: trabajadores[1].id, terminalOrigenId: terminal.id, seccionId: seccionB.id, fecha: FECHA("2026-08-05"), hora: HORA("09:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella },
    ] });
    const reporte = await obtenerReporteAsistencia("2026-08-05", "2026-08-05");
    expect(reporte.resumen).toMatchObject({ presentes: 2, aTiempo: 1, tardanzas: 1, porcentajePuntualidad: 50, diasHabiles: 1 });
    expect(reporte.porSeccion.map((fila) => fila.seccionNombre)).toEqual(["Frente B", "Oficina"]);
    const vacio = await obtenerReporteAsistencia("2026-08-08", "2026-08-09");
    expect(vacio.resumen).toMatchObject({ presentes: 0, aTiempo: 0, tardanzas: 0, ausentes: 0, porcentajePuntualidad: null, diasHabiles: 0 });
    expect(vacio.tendencia).toHaveLength(2);
  });

  it("construye el histórico individual con orden, ausencias y clasificación", async () => {
    const { seccion, terminal, trabajadores } = await escenarioBase();
    const horario = await prisma.horario.create({ data: { nombre: "Turno histórico", horaEntrada: HORA("08:00:00"), horaSalida: HORA("17:00:00"), toleranciaMinutos: 10 } });
    await prisma.seccion.update({ where: { id: seccion.id }, data: { horarioId: horario.id } });
    await prisma.asistenciaDiaria.createMany({ data: [
      { trabajadorId: trabajadores[0].id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA("2026-08-03"), hora: HORA("08:00:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella },
      { trabajadorId: trabajadores[0].id, terminalOrigenId: terminal.id, seccionId: seccion.id, fecha: FECHA("2026-08-05"), hora: HORA("08:11:00"), turno: "Día", metodoUsado: MetodoAsistencia.huella },
    ] });
    const historico = await obtenerHistoricoTrabajador(trabajadores[0].id, "2026-08-03", "2026-08-07");
    expect(historico.dias.map((dia) => dia.fecha)).toEqual(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]);
    expect(historico.dias.map((dia) => dia.presente)).toEqual([true, false, true, false, false]);
    expect(historico.dias.map((dia) => dia.aTiempo)).toEqual([true, null, false, null, null]);
    expect(historico.resumen).toMatchObject({ presentes: 2, aTiempo: 1, tardanzas: 1, ausentes: 3, diasHabiles: 5 });
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
    const inicial = await request(app).get("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`);
    expect(inicial.body.obra.timezoneObra).toBeNull();
    expect((await request(app).patch("/obras/actual").set("Authorization", `Bearer ${tokenRh}`).send({ nombre: "No permitido" })).status).toBe(403);
    expect((await request(app).patch("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`).send({ nombre: "Obra inválida", timezoneObra: "CST" })).status).toBe(400);
    const actualizada = await request(app).patch("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`).send({ nombre: "Obra integración actualizada", timezoneObra: "America/Matamoros" });
    expect(actualizada.status).toBe(200);
    expect(actualizada.body.obra.nombre).toBe("Obra integración actualizada");
    expect(actualizada.body.obra.timezoneObra).toBe("America/Matamoros");
    const persistida = await request(app).get("/obras/actual").set("Authorization", `Bearer ${tokenAdministrador}`);
    expect(persistida.body.obra.timezoneObra).toBe("America/Matamoros");
    expect(await prisma.auditLog.count({ where: { accion: "editar_obra", usuarioId: usuarios.get(RolUsuario.administrador)!.id } })).toBe(1);
    expect((await prisma.auditLog.findFirst({ where: { accion: "editar_obra", usuarioId: usuarios.get(RolUsuario.administrador)!.id } }))?.detalle).toMatchObject({ timezoneObraAnterior: null, timezoneObraNueva: "America/Matamoros" });
  });
});

describe("HTTP real: candidato de reconciliación ADMS", () => {
  it("permite solo Administrador/RH y devuelve candidatos activos por PIN", async () => {
    const { trabajadores, usuarios } = await escenarioBase();
    await prisma.trabajador.update({ where: { id: trabajadores[1].id }, data: { numeroChecador: 1001 } });
    await prisma.trabajador.update({ where: { id: trabajadores[0].id }, data: { numeroChecador: 1 } });
    const inactivo = await prisma.trabajador.create({ data: { nombreCompleto: "Inactivo", categoria: "Operación", jefeInmediato: "Jefe", numeroChecador: 2001, estatus: TrabajadorEstatus.baja } });
    const [admin, rh, recepcion, encargado] = await Promise.all([
      tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.recepcion),
      tokenHumano(RolUsuario.encargado_seccion),
    ]);
    const trabajador = jwt.sign({
      usuarioId: usuarios.get(RolUsuario.trabajador)!.id,
      rol: RolUsuario.trabajador,
      trabajadorId: usuarios.get(RolUsuario.trabajador)!.trabajadorId,
    }, process.env.JWT_SECRET!, { expiresIn: "5m" });
    for (const token of [admin, rh]) {
      const encontrado = await request(app).get("/trabajadores/candidato-reconciliacion?pin=001").set("Authorization", `Bearer ${token}`);
      expect(encontrado.status).toBe(200);
      expect(encontrado.body).toEqual({ candidato: { id: trabajadores[0].id, nombreCompleto: "Trabajador A", estatus: "activo", numeroChecador: 1 } });
      expect(Object.keys(encontrado.body.candidato).sort()).toEqual(["estatus", "id", "nombreCompleto", "numeroChecador"]);
    }
    expect((await request(app).get("/trabajadores/candidato-reconciliacion?pin=2001").set("Authorization", `Bearer ${rh}`)).body).toEqual({ candidato: null });
    expect((await request(app).get("/trabajadores/candidato-reconciliacion?pin=9999").set("Authorization", `Bearer ${admin}`)).body).toEqual({ candidato: null });
    for (const token of [recepcion, encargado, trabajador]) {
      expect((await request(app).get("/trabajadores/candidato-reconciliacion?pin=1").set("Authorization", `Bearer ${token}`)).status).toBe(403);
    }
    for (const pin of ["", "   ", "ABC", "1.5", "-1", "12ABC"]) {
      expect((await request(app).get(`/trabajadores/candidato-reconciliacion?pin=${encodeURIComponent(pin)}`).set("Authorization", `Bearer ${admin}`)).status).toBe(400);
    }
    expect(inactivo.id).toBeTruthy();
    expect(usuarios.get(RolUsuario.administrador)?.rol).toBe(RolUsuario.administrador);
  });
});

describe("HTTP real: responsables operativos del tramo", () => {
  it("filtra el catálogo de Frentes por Obra sin alterar el listado legacy", async () => {
    const { seccion } = await escenarioBase();
    const obraA = seccion.obraId;
    const obraB = await prisma.obra.create({ data: { nombre: "Obra B catálogo" } });
    const seccionA2 = await prisma.seccion.create({ data: { obraId: obraA, nombre: "Frente A2" } });
    const seccionB1 = await prisma.seccion.create({ data: { obraId: obraB.id, nombre: "Frente B1" } });
    const tokenRh = await tokenHumano(RolUsuario.rh);

    const filtradaA = await request(app).get(`/secciones?obraId=${obraA}`).set("Authorization", `Bearer ${tokenRh}`);
    expect(filtradaA.status).toBe(200);
    expect(filtradaA.body.secciones.map((s: { id: string }) => s.id)).toEqual([seccionA2.id, seccion.id]);
    expect(filtradaA.body.secciones.map((s: { obraId: string }) => s.obraId)).toEqual([obraA, obraA]);

    const filtradaB = await request(app).get(`/secciones?obraId=${obraB.id}`).set("Authorization", `Bearer ${tokenRh}`);
    expect(filtradaB.body.secciones.map((s: { id: string }) => s.id)).toEqual([seccionB1.id]);

    const inexistente = await request(app).get("/secciones?obraId=77777777-7777-4777-8777-777777777777").set("Authorization", `Bearer ${tokenRh}`);
    expect(inexistente.status).toBe(200);
    expect(inexistente.body.secciones).toEqual([]);

    expect((await request(app).get("/secciones?obraId=no-es-uuid").set("Authorization", `Bearer ${tokenRh}`)).status).toBe(400);
    expect((await request(app).get(`/secciones?obraId=${obraA}&obraId=${obraB.id}`).set("Authorization", `Bearer ${tokenRh}`)).status).toBe(400);

    const legacy = await request(app).get("/secciones").set("Authorization", `Bearer ${tokenRh}`);
    expect(legacy.status).toBe(200);
    expect(legacy.body.secciones.map((s: { nombre: string }) => s.nombre)).toEqual(["Frente A2", "Frente B1", "Oficina"]);
  });

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
    const { seccion, trabajadores, usuarios } = await escenarioBase();
    // ATTLOG resuelve el Frente desde la asignación diaria del trabajador;
    // el fixture debe declarar explícitamente que este trabajador estaba
    // asignado ese día, en vez de depender de un Frente "Oficina" implícito.
    await prisma.asignacionDiaria.create({
      data: { trabajadorId: trabajadores[0].id, seccionId: seccion.id, fecha: FECHA("2026-08-03"), asignadoPor: usuarios.get(RolUsuario.rh)!.id },
    });
    const cuerpo = "101\t2026-08-03 08:01:02\t0\t1\n999\t2026-08-03 08:02:03\t0\t15";
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/iclock/cdata?SN=SN-INTEGRATION-1&table=ATTLOG").set("Content-Type", "text/plain").send(cuerpo);
      expect(res.status).toBe(200);
      expect(res.text).toBe("OK");
    }
    expect(await prisma.asistenciaDiaria.count({ where: { trabajadorId: trabajadores[0].id } })).toBe(1);
    expect(await prisma.eventoNoReconciliado.count({ where: { pinDispositivo: "999" } })).toBe(1);
    const evento = await prisma.eventoNoReconciliado.findFirstOrThrow({ where: { pinDispositivo: "999" } });
    expect(evento.obraId).toBe((await prisma.terminal.findUniqueOrThrow({ where: { id: evento.terminalId } })).obraId);
    expect(evento.fechaMarcacion?.toISOString().slice(0, 10)).toBe("2026-08-03");
    expect(evento.horaMarcacion?.toISOString().slice(11, 19)).toBe("08:02:03");
    expect(evento.marcadoEn.toISOString()).toBe("2026-08-03T08:02:03.000Z");
    expect(evento.creadoEn).toBeInstanceOf(Date);
    expect(await prisma.trabajador.count()).toBe(2);
    expect((await request(app).get("/iclock/cdata?SN=SN-FALSO")).status).toBe(403);
  });

  it("conserva el snapshot de Obra al cambiar la terminal y deja null en terminal legacy", async () => {
    const { adms } = await escenarioBase();
    const obraA = (await prisma.terminal.findUniqueOrThrow({ where: { id: adms.id }, select: { obraId: true } })).obraId;
    const obraB = await prisma.obra.create({ data: { nombre: "Obra B snapshot" } });
    await request(app).post("/iclock/cdata?SN=SN-INTEGRATION-1&table=ATTLOG").set("Content-Type", "text/plain").send("900\t2026-08-04 08:00:00\t0\t1");
    await prisma.terminal.update({ where: { id: adms.id }, data: { obraId: obraB.id } });
    await request(app).post("/iclock/cdata?SN=SN-INTEGRATION-1&table=ATTLOG").set("Content-Type", "text/plain").send("901\t2026-08-04 08:01:00\t0\t1");
    const eventos = await prisma.eventoNoReconciliado.findMany({ where: { pinDispositivo: { in: ["900", "901"] } }, orderBy: { pinDispositivo: "asc" } });
    expect(eventos.map((e) => e.obraId)).toEqual([obraA, obraB.id]);

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await prisma.terminal.create({ data: { username: "adms-legacy-20a", passwordHash, tipo: "adms", ubicacion: "Legacy", numeroSerie: "SN-LEGACY-20A" } });
    await request(app).post("/iclock/cdata?SN=SN-LEGACY-20A&table=ATTLOG").set("Content-Type", "text/plain").send("902\t2026-08-04 08:02:00\t0\t1");
    expect((await prisma.eventoNoReconciliado.findFirstOrThrow({ where: { pinDispositivo: "902" } })).obraId).toBeNull();
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
    await prisma.eventoNoReconciliado.create({ data: { terminalId: adms.id, pinDispositivo: "PIN-FICTICIO", fechaMarcacion: new Date("2026-08-14T00:00:00Z"), horaMarcacion: new Date("1970-01-01T10:00:00Z"), marcadoEn: new Date("2026-08-14T10:00:00Z"), metodoCrudo: "1" } });
    const [tokenRh, tokenAdmin, tokenRecepcion] = await Promise.all([tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.administrador), tokenHumano(RolUsuario.recepcion)]);
    for (const token of [tokenRh, tokenAdmin]) {
      const respuesta = await request(app).get("/incidencias?limite=10").set("Authorization", `Bearer ${token}`);
      expect(respuesta.status).toBe(200); expect(respuesta.body.total).toBe(1);
      expect(respuesta.body.items[0]).toMatchObject({ fechaMarcacion: "2026-08-14", horaMarcacion: "10:00:00", fechaEvento: "2026-08-14T10:00:00.000Z" });
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

describe("PostgreSQL/HTTP real: reconciliación ADMS", () => {
  async function crearEvento(admsId: string, pin = "101", fecha = "2026-08-25", hora = "23:59:59") {
    const terminal = await prisma.terminal.findUniqueOrThrow({ where: { id: admsId }, select: { obraId: true } });
    return prisma.eventoNoReconciliado.create({
      data: {
        terminalId: admsId,
        obraId: terminal.obraId,
        pinDispositivo: pin,
        fechaMarcacion: FECHA(fecha),
        horaMarcacion: HORA(hora),
        // Deliberadamente distinto: la reconciliación no debe usar marcadoEn.
        marcadoEn: new Date("2026-08-26T05:59:59Z"),
        metodoCrudo: "15",
      },
    });
  }

  it("crea asistencia civil, vincula evento y registra auditoría", async () => {
    const { adms, seccion, trabajadores, usuarios } = await escenarioBase();
    const evento = await crearEvento(adms.id);
    const token = await tokenHumano(RolUsuario.rh);
    const respuesta = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send({ trabajadorId: trabajadores[0].id, seccionId: seccion.id });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultado).toBe("reconciliado");
    const asistencia = await prisma.asistenciaDiaria.findFirstOrThrow({ where: { trabajadorId: trabajadores[0].id } });
    expect(asistencia.fecha.toISOString().slice(0, 10)).toBe("2026-08-25");
    expect(asistencia.hora.toISOString().slice(11, 19)).toBe("23:59:59");
    expect(asistencia.terminalOrigenId).toBe(adms.id);
    expect(asistencia.seccionId).toBe(seccion.id);
    const actualizado = await prisma.eventoNoReconciliado.findUniqueOrThrow({ where: { id: evento.id } });
    expect(actualizado.asistenciaId).toBe(asistencia.id);
    expect(actualizado.reconciliadoPorId).toBe(usuarios.get(RolUsuario.rh)!.id);
    expect(actualizado.reconciliadoEn).toBeInstanceOf(Date);
    expect(await prisma.auditLog.count({ where: { accion: "reconciliar_evento_adms", entidadId: evento.id } })).toBe(1);
  });

  it("es idempotente y rechaza cambiar el objetivo de un evento ya reconciliado", async () => {
    const { adms, seccion, trabajadores } = await escenarioBase();
    const evento = await crearEvento(adms.id);
    const token = await tokenHumano(RolUsuario.administrador);
    const payload = { trabajadorId: trabajadores[0].id, seccionId: seccion.id };
    const primera = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send(payload);
    const segunda = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send(payload);
    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(segunda.body.resultado).toBe("ya_reconciliado");
    expect(await prisma.asistenciaDiaria.count()).toBe(1);

    const otraSeccion = await prisma.seccion.create({ data: { obraId: (await prisma.obra.findFirstOrThrow()).id, nombre: "Frente alterno" } });
    const conflicto = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send({ ...payload, seccionId: otraSeccion.id });
    expect(conflicto.status).toBe(409);
    expect(await prisma.asistenciaDiaria.count()).toBe(1);
  });

  it("reutiliza una asistencia exacta ya existente sin duplicarla", async () => {
    const { adms, seccion, trabajadores } = await escenarioBase();
    const evento = await crearEvento(adms.id, "101", "2026-08-25", "08:00:00");
    const existente = await prisma.asistenciaDiaria.create({ data: { trabajadorId: trabajadores[0].id, terminalOrigenId: adms.id, seccionId: seccion.id, fecha: FECHA("2026-08-25"), hora: HORA("08:00:00"), turno: "Oficina", metodoUsado: MetodoAsistencia.huella } });
    const token = await tokenHumano(RolUsuario.rh);
    const respuesta = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send({ trabajadorId: trabajadores[0].id, seccionId: seccion.id });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultado).toBe("ya_existia");
    expect(respuesta.body.asistencia.id).toBe(existente.id);
    expect(await prisma.asistenciaDiaria.count()).toBe(1);
  });

  it("rechaza reconciliar una incidencia contra un Frente de otra Obra", async () => {
    const { adms, seccion, trabajadores } = await escenarioBase();
    const otraObra = await prisma.obra.create({ data: { nombre: "Obra B" } });
    const frenteOtraObra = await prisma.seccion.create({ data: { obraId: otraObra.id, nombre: "Frente B" } });
    const evento = await crearEvento(adms.id);
    const token = await tokenHumano(RolUsuario.rh);
    const respuesta = await request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send({ trabajadorId: trabajadores[0].id, seccionId: frenteOtraObra.id });
    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error).toContain("no pertenece a la Obra de origen");
    expect(await prisma.asistenciaDiaria.count()).toBe(0);
    expect((await prisma.eventoNoReconciliado.findUniqueOrThrow({ where: { id: evento.id } })).asistenciaId).toBeNull();
    expect(await prisma.auditLog.count({ where: { accion: "reconciliar_evento_adms", entidadId: evento.id } })).toBe(0);
    expect(seccion.obraId).not.toBe(otraObra.id);
  });

  it("dos reconciliaciones concurrentes producen una sola asistencia", async () => {
    const { adms, seccion, trabajadores } = await escenarioBase();
    const evento = await crearEvento(adms.id, "101", "2026-08-26", "00:00:00");
    const token = await tokenHumano(RolUsuario.rh);
    const payload = { trabajadorId: trabajadores[0].id, seccionId: seccion.id };
    const respuestas = await Promise.all([
      request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send(payload),
      request(app).post(`/incidencias/${evento.id}/reconciliar`).set("Authorization", `Bearer ${token}`).send(payload),
    ]);
    expect(respuestas.every((respuesta) => respuesta.status === 200)).toBe(true);
    expect(respuestas.map((respuesta) => respuesta.body.resultado).sort()).toEqual(["reconciliado", "ya_reconciliado"]);
    expect(await prisma.asistenciaDiaria.count()).toBe(1);
    expect(await prisma.eventoNoReconciliado.count({ where: { asistenciaId: { not: null } } })).toBe(1);
  });

  it("rechaza históricos ambiguos, PIN reasignado, inactivos y roles no autorizados", async () => {
    const { adms, seccion, trabajadores } = await escenarioBase();
    const historico = await prisma.eventoNoReconciliado.create({ data: { terminalId: adms.id, pinDispositivo: "101", marcadoEn: new Date("2026-08-25T23:59:59Z"), metodoCrudo: "1" } });
    const otro = await crearEvento(adms.id, "999");
    const inactivoEvento = await crearEvento(adms.id, "999", "2026-08-26", "00:00:00");
    const inactivo = trabajadores[1];
    await prisma.trabajador.update({ where: { id: inactivo.id }, data: { estatus: TrabajadorEstatus.baja, numeroChecador: 999 } });
    const [tokenRh, tokenRecepcion] = await Promise.all([tokenHumano(RolUsuario.rh), tokenHumano(RolUsuario.recepcion)]);
    expect((await request(app).post(`/incidencias/${historico.id}/reconciliar`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id, seccionId: seccion.id })).status).toBe(422);
    expect((await request(app).post(`/incidencias/${otro.id}/reconciliar`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[0].id, seccionId: seccion.id })).status).toBe(422);
    expect((await request(app).post(`/incidencias/${inactivoEvento.id}/reconciliar`).set("Authorization", `Bearer ${tokenRh}`).send({ trabajadorId: trabajadores[1].id, seccionId: seccion.id })).status).toBe(422);
    expect((await request(app).post(`/incidencias/${otro.id}/reconciliar`).set("Authorization", `Bearer ${tokenRecepcion}`).send({ trabajadorId: trabajadores[1].id, seccionId: seccion.id })).status).toBe(403);
    expect(await prisma.asistenciaDiaria.count()).toBe(0);
  });
});

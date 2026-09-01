import { MetodoAsistencia, TrabajadorEstatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ terminal: vi.fn(), trabajador: vi.fn(), seccion: vi.fn(), asignacion: vi.fn(), asistencia: vi.fn(), eventoBuscar: vi.fn(), eventoCrear: vi.fn(), registrar: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: {
  terminal: { findUnique: mocks.terminal }, trabajador: { findUnique: mocks.trabajador }, seccion: { findFirst: mocks.seccion },
  asignacionDiaria: { findUnique: mocks.asignacion },
  asistenciaDiaria: { findFirst: mocks.asistencia }, eventoNoReconciliado: { findFirst: mocks.eventoBuscar, create: mocks.eventoCrear },
} }));
vi.mock("../src/services/asistencia.service", () => ({ registrarAsistencia: mocks.registrar }));

import { calcularOffsetZonaHoraria, generarRespuestaHandshake, mapearPunchMarcacion, parseFechaHoraCivilAdms, parsearLineaAttlog, procesarLoteAttlog, resolverTerminalPorSN } from "../src/services/adms.service";

const terminal = { id: "term-adms", numeroSerie: "SN-LOCAL", activo: true, obraId: "obra-1" } as never;

beforeEach(() => {
  mocks.trabajador.mockResolvedValue({ id: "t1", estatus: TrabajadorEstatus.activo });
  mocks.seccion.mockResolvedValue({ id: "seccion-asignada" });
  mocks.asignacion.mockResolvedValue({ seccion: { id: "seccion-asignada", obraId: "obra-1" } });
  mocks.asistencia.mockResolvedValue(null);
  mocks.eventoBuscar.mockResolvedValue(null);
  mocks.eventoCrear.mockResolvedValue({});
  mocks.registrar.mockResolvedValue({});
});

describe("ADMS", () => {
  it.each([
    [0, "entrada"], [1, "salida"], [2, "salida_descanso"], [3, "entrada_descanso"],
    [4, "entrada_tiempo_extra"], [5, "salida_tiempo_extra"],
  ])("mapea punch %s a %s", (punch, tipo) => expect(mapearPunchMarcacion(punch)).toBe(tipo));

  it("deja punch desconocido sin categoría", () => {
    expect(mapearPunchMarcacion(99)).toBeNull();
    expect(parsearLineaAttlog("42\t2026-08-08 08:15:30\t99\t1")).toMatchObject({ punchCrudo: 99, tipoMarcacion: null });
    expect(parsearLineaAttlog("42\t2026-08-08 08:15:30\tno-disponible\t1")).toMatchObject({ punchCrudo: null, tipoMarcacion: null });
  });
  it("calcula el TimeZone ADMS desde la zona IANA de la obra", () => {
    expect(calcularOffsetZonaHoraria("America/Matamoros", new Date("2026-08-29T15:00:00Z"))).toBe(-5);
    expect(calcularOffsetZonaHoraria("America/Matamoros", new Date("2026-01-15T15:00:00Z"))).toBe(-6);
  });

  it("falla claramente si la zona IANA no se puede resolver", () => {
    expect(() => calcularOffsetZonaHoraria("Zona/Inexistente")).toThrow(
      'No se pudo resolver la zona horaria IANA "Zona/Inexistente".'
    );
  });

  it("incluye TimeZone en el handshake", () => {
    expect(generarRespuestaHandshake("SN-LOCAL", -5)).toContain("\nTimeZone=-5\n");
  });

  it("mantiene el handshake anterior cuando no hay zona horaria", () => {
    expect(generarRespuestaHandshake("SN-LOCAL")).not.toContain("TimeZone=");
  });

  it("parsea un ATTLOG válido", () => {
    expect(parsearLineaAttlog("42\t2026-08-08 08:15:30\t0\t15")).toEqual({
      pin: "42",
      fechaCivil: "2026-08-08",
      horaCivil: "08:15:30",
      fechaHora: new Date("2026-08-08T08:15:30Z"),
      metodoVerifyCrudo: "15",
      punchCrudo: 0,
      tipoMarcacion: "entrada",
    });
  });

  it("separa fecha y hora civiles sin usar la zona del proceso", () => {
    expect(parseFechaHoraCivilAdms("2026-08-25 23:59:59")).toEqual({ fechaCivil: "2026-08-25", horaCivil: "23:59:59" });
    expect(parseFechaHoraCivilAdms("2026-08-26 00:00:00")).toEqual({ fechaCivil: "2026-08-26", horaCivil: "00:00:00" });
    expect(parsearLineaAttlog("42\t2026-08-25 23:59:59\t0\t1")?.fechaHora.toISOString()).toBe("2026-08-25T23:59:59.000Z");
    expect(parsearLineaAttlog("42\t2026-08-26 00:00:00\t0\t1")?.fechaHora.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("valida calendario y rechaza offsets o rangos imposibles", () => {
    for (const valor of [
      "2026-02-30 08:00:00",
      "2026-13-01 08:00:00",
      "2026-00-10 08:00:00",
      "2026-08-25 24:00:00",
      "2026-08-25 08:60:00",
      "2026-08-25 08:00:60",
      "2026-08-25T08:00:00Z",
      "2026-08-25 08:00:00-05:00",
    ]) {
      expect(parseFechaHoraCivilAdms(valor)).toBeNull();
      expect(parsearLineaAttlog(`42\t${valor}\t0\t1`)).toBeNull();
    }
    expect(parseFechaHoraCivilAdms("2028-02-29 00:00:00")).toEqual({ fechaCivil: "2028-02-29", horaCivil: "00:00:00" });
  });

  it("conserva días y horas civiles independientes al cruzar medianoche", async () => {
    await expect(
      procesarLoteAttlog(
        terminal,
        [
          "42\t2026-08-25 23:59:59\t0\t1",
          "42\t2026-08-26 00:00:00\t0\t1",
        ].join("\n")
      )
    ).resolves.toEqual({ procesados: 2, duplicados: 0, noReconciliados: 0 });

    expect(mocks.registrar).toHaveBeenNthCalledWith(
      1,
      "t1",
      "term-adms",
      expect.objectContaining({ fecha: "2026-08-25", hora: "23:59:59" })
    );
    expect(mocks.registrar).toHaveBeenNthCalledWith(
      2,
      "t1",
      "term-adms",
      expect.objectContaining({ fecha: "2026-08-26", hora: "00:00:00" })
    );
  });

  it("registra el PIN conocido con el Frente de su asignación diaria", async () => {
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t15")).resolves.toEqual({ procesados: 1, duplicados: 0, noReconciliados: 0 });
    expect(mocks.registrar).toHaveBeenCalledWith("t1", "term-adms", expect.objectContaining({ seccionId: "seccion-asignada", metodoUsado: MetodoAsistencia.rostro }));
  });

  it("guarda un PIN desconocido como EventoNoReconciliado sin inventar trabajador", async () => {
    mocks.trabajador.mockResolvedValue(null);
    await expect(procesarLoteAttlog(terminal, "999\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 0, noReconciliados: 1 });
    expect(mocks.eventoCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ pinDispositivo: "999", terminalId: "term-adms" }) });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("registra asistencia sin sección si falta asignación diaria", async () => {
    mocks.asignacion.mockResolvedValue(null);
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 1, duplicados: 0, noReconciliados: 0 });
    expect(mocks.registrar).toHaveBeenCalledWith("t1", "term-adms", expect.objectContaining({ obraId: "obra-1", seccionId: null }));
    expect(mocks.eventoCrear).not.toHaveBeenCalled();
  });

  it("rechaza una asignación diaria de otra Obra", async () => {
    mocks.asignacion.mockResolvedValue({ seccion: { id: "seccion-otra", obraId: "obra-2" } });
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 0, noReconciliados: 1 });
    expect(mocks.registrar).not.toHaveBeenCalled();
    expect(mocks.eventoCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ obraId: "obra-1", pinDispositivo: "42" }) });
  });

  it("no crea asistencia para una terminal ADMS sin Obra", async () => {
    const terminalSinObra = { ...terminal, obraId: null } as never;
    await expect(procesarLoteAttlog(terminalSinObra, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 0, noReconciliados: 1 });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("conserva como no reconciliado un ATTLOG de trabajador inactivo", async () => {
    mocks.trabajador.mockResolvedValue({ id: "t-inactivo", estatus: TrabajadorEstatus.baja });
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 0, noReconciliados: 1 });
    expect(mocks.eventoCrear).toHaveBeenCalledWith({ data: expect.objectContaining({ pinDispositivo: "42", obraId: "obra-1" }) });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it("detecta un ATTLOG conocido duplicado", async () => {
    mocks.asistencia.mockResolvedValue({ id: "a1" });
    await expect(procesarLoteAttlog(terminal, "42\t2026-08-08 08:15:30\t0\t1")).resolves.toEqual({ procesados: 0, duplicados: 1, noReconciliados: 0 });
  });

  it("mantiene marcaciones independientes cuando solo cambia la hora civil", async () => {
    await expect(procesarLoteAttlog(terminal, [
      "42\t2026-08-08 08:15:30\t0\t1",
      "42\t2026-08-08 17:00:00\t0\t1",
    ].join("\n"))).resolves.toEqual({ procesados: 2, duplicados: 0, noReconciliados: 0 });
    expect(mocks.registrar).toHaveBeenCalledTimes(2);
  });

  it("exige número de serie", async () => {
    await expect(resolverTerminalPorSN(undefined)).rejects.toMatchObject({ status: 400 });
    expect(mocks.terminal).not.toHaveBeenCalled();
  });

  it("rechaza un número de serie no reconocido", async () => {
    mocks.terminal.mockResolvedValue(null);
    await expect(resolverTerminalPorSN("SN-FALSO")).rejects.toMatchObject({ status: 403 });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ eventos: vi.fn(), eventosCount: vi.fn(), auditoria: vi.fn(), auditoriaCount: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: { eventoNoReconciliado: { findMany: mocks.eventos, count: mocks.eventosCount }, auditLog: { findMany: mocks.auditoria, count: mocks.auditoriaCount } } }));
import { listarIncidencias } from "../src/services/incidencia.service";
import { listarAuditoria, sanitizarDetalleAuditoria } from "../src/services/auditoria.service";
beforeEach(() => { mocks.eventos.mockResolvedValue([]); mocks.eventosCount.mockResolvedValue(0); mocks.auditoria.mockResolvedValue([]); mocks.auditoriaCount.mockResolvedValue(0); });
describe("modelos empresariales de solo lectura", () => {
  it("normaliza eventos ADMS pendientes y reconciliados sin perder compatibilidad", async () => {
    const reconciliadoEn = new Date("2026-08-14T10:02:00Z");
    mocks.eventos.mockResolvedValue([
      { id: "e1", pinDispositivo: "999", asistenciaId: null, reconciliadoEn: null, marcadoEn: new Date("2026-08-14T10:00:00Z"), creadoEn: new Date("2026-08-14T10:01:00Z"), terminal: { username: "reloj-test", ubicacion: "Oficina test" } },
      { id: "e2", pinDispositivo: "100", asistenciaId: "asistencia-1", reconciliadoEn, marcadoEn: new Date("2026-08-14T11:00:00Z"), creadoEn: new Date("2026-08-14T11:01:00Z"), terminal: { username: "reloj-test", ubicacion: "Oficina test" } },
    ]); mocks.eventosCount.mockResolvedValue(2);
    const resultado = await listarIncidencias({ pagina: 1, limite: 25 });
    expect(resultado.items[0]).toMatchObject({ tipo: "ADMS_NO_RECONCILIADO", estado: "pendiente", asistenciaId: null, reconciliadoEn: null, identificadorDispositivo: "999" });
    expect(resultado.items[1]).toMatchObject({ estado: "reconciliada", asistenciaId: "asistencia-1", reconciliadoEn: reconciliadoEn.toISOString() });
    expect(mocks.eventos).toHaveBeenCalledWith(expect.objectContaining({ take: 25, skip: 0, select: expect.any(Object) }));
  });
  it("oculta secretos y cantidades de metadata de auditoría", () => {
    expect(sanitizarDetalleAuditoria({ username: "ficticio", password: "NO-MOSTRAR", token: "NO-MOSTRAR", montoSueldo: "999", camposEditados: ["nombreCompleto", "sueldoBase", "clabe"] })).toEqual(["username: ficticio", "Campos actualizados: nombreCompleto"]);
  });
  it("pagina auditoría, ordena por fecha y no devuelve metadata cruda", async () => {
    mocks.auditoria.mockResolvedValue([{ id: "a1", accion: "resetear_password", entidad: "Usuario", entidadId: "u1", fecha: new Date("2026-08-14T10:00:00Z"), detalle: { username: "demo", password: "oculta" }, usuario: { username: "admin-test" } }]); mocks.auditoriaCount.mockResolvedValue(1);
    const resultado = await listarAuditoria({ pagina: 2, limite: 10 });
    expect(resultado.registros[0].detalle).toEqual(["username: demo"]);
    expect(mocks.auditoria).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: { fecha: "desc" } }));
  });
});

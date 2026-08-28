import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ section: vi.fn(), findMany: vi.fn(), access: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: { seccion: { findUnique: mocks.section }, asignacionDiaria: { findMany: mocks.findMany } } }));
vi.mock("../src/utils/accesoSeccion", () => ({ verificarAccesoSeccion: mocks.access }));

import { obtenerAsignacionesActuales } from "../src/services/asignacion.service";
import { RolUsuario } from "@prisma/client";

describe("GET asignaciones actuales", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.section.mockResolvedValue({ id: "s1" }); mocks.findMany.mockResolvedValue([]); });

  it("devuelve cero asignaciones sin cambiar la fecha civil", async () => {
    await expect(obtenerAsignacionesActuales("u1", RolUsuario.rh, "11111111-1111-4111-8111-111111111111", "2026-08-28")).resolves.toEqual({
      seccionId: "11111111-1111-4111-8111-111111111111", fecha: "2026-08-28", trabajadores: [],
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { seccionId: "11111111-1111-4111-8111-111111111111", fecha: new Date("2026-08-28T00:00:00Z") } }));
  });

  it("expone únicamente campos seguros de trabajadores", async () => {
    mocks.findMany.mockResolvedValue([{ trabajador: { id: "t1", nombreCompleto: "Gibran", numeroChecador: 990001, estatus: "activo" } }]);
    const resultado = await obtenerAsignacionesActuales("u1", RolUsuario.rh, "s1", "2026-08-28");
    expect(resultado.trabajadores).toEqual([{ trabajadorId: "t1", nombreCompleto: "Gibran", numeroChecador: 990001, estatus: "activo" }]);
  });
});

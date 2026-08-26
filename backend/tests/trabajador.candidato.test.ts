import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../src/utils/prisma", () => ({ prisma: { trabajador: { findFirst: mocks.findFirst } } }));

import { buscarCandidatoReconciliacion } from "../src/services/trabajador.service";
import { normalizarPinReconciliacion } from "../src/middlewares/validarTrabajador";

describe("candidato activo para reconciliación ADMS", () => {
  beforeEach(() => mocks.findFirst.mockReset());

  it("consulta por número y devuelve únicamente el DTO mínimo", async () => {
    mocks.findFirst.mockResolvedValue({ id: "t1", nombreCompleto: "Ana López", estatus: "activo", numeroChecador: 1001 });
    await expect(buscarCandidatoReconciliacion(1001)).resolves.toEqual({ id: "t1", nombreCompleto: "Ana López", estatus: "activo", numeroChecador: 1001 });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { numeroChecador: 1001, estatus: "activo" },
      select: { id: true, nombreCompleto: true, estatus: true, numeroChecador: true },
    });
  });

  it("devuelve null cuando no hay candidato activo", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(buscarCandidatoReconciliacion(2001)).resolves.toBeNull();
  });

  it.each([["1", 1], ["001", 1], ["1001", 1001], [" 001 ", 1]])("normaliza PIN %s", (pin, esperado) => {
    expect(normalizarPinReconciliacion(pin)).toBe(esperado);
  });

  it.each([undefined, null, "", "   ", "ABC", "1.5", "-1", "12ABC", "1e2", "2147483648", ["1"]])(
    "rechaza PIN inválido %s",
    (pin) => expect(normalizarPinReconciliacion(pin)).toBeNull(),
  );
});

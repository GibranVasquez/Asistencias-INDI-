import { describe, expect, it, vi } from "vitest";
import { validarSugerenciaAsignacion } from "../src/middlewares/validarAsignacion";

function ejecutar(query: Record<string, unknown>) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  validarSugerenciaAsignacion({ query } as never, res as never, next);
  return { res, next };
}

describe("validación de GET /asignaciones", () => {
  it("rechaza UUID inválido y fecha con timestamp", () => {
    const { res, next } = ejecutar({ seccionId: "no-uuid", fecha: "2026-08-28T00:00:00Z" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("acepta fecha civil exacta", () => {
    const { next } = ejecutar({ seccionId: "11111111-1111-4111-8111-111111111111", fecha: "2026-08-28" });
    expect(next).toHaveBeenCalledOnce();
  });
});

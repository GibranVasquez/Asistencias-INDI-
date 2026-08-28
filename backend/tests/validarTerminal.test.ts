import { describe, expect, it, vi } from "vitest";
import { validarAltaTerminal } from "../src/middlewares/validarAltaTerminal";
import { validarEdicionTerminal } from "../src/middlewares/validarEdicionTerminal";

function contexto(body: unknown) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  validarAltaTerminal({ body } as never, res as never, next);
  return { res, next };
}

describe("contrato de alta de terminal ADMS", () => {
  it("exige SN y Obra", () => {
    const { res, next } = contexto({ username: "s922", tipo: "adms", ubicacion: "Campo" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("acepta alta ADMS con SN y UUID de Obra", () => {
    const { next } = contexto({ username: "s922", tipo: "adms", ubicacion: "Campo", numeroSerie: "UCP6241900020", obraId: "11111111-1111-4111-8111-111111111111" });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("contrato de edición de terminal", () => {
  it("no permite cambiar el tipo", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    validarEdicionTerminal({ params: { id: "11111111-1111-4111-8111-111111111111" }, body: { tipo: "kiosco" } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

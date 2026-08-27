import { describe, expect, it } from "vitest";
import { validarAltaUsuario } from "../src/middlewares/validarAltaUsuario";

function ejecutar(body: Record<string, unknown>) {
  let status = 200;
  let respuesta: unknown;
  let avanzo = false;
  const req = { body } as never;
  const res = { status(codigo: number) { status = codigo; return this; }, json(valor: unknown) { respuesta = valor; } } as never;
  validarAltaUsuario(req, res, () => { avanzo = true; });
  return { status, respuesta, avanzo };
}

const base = { username: "cuenta", password: "Segura123!", rol: "encargado_seccion", seccionesAsignadas: ["11111111-1111-4111-8111-111111111111"] };

describe("vínculo opcional Usuario-Trabajador", () => {
  it("permite encargado sin trabajador o con vínculo UUID", () => {
    expect(ejecutar(base).avanzo).toBe(true);
    expect(ejecutar({ ...base, trabajadorId: "22222222-2222-4222-8222-222222222222" }).avanzo).toBe(true);
  });

  it("rechaza trabajadorId inválido para encargado", () => {
    const resultado = ejecutar({ ...base, trabajadorId: "no-uuid" });
    expect(resultado.status).toBe(400);
    expect(resultado.avanzo).toBe(false);
  });

  it("mantiene trabajadorId obligatorio para cuenta trabajador", () => {
    const resultado = ejecutar({ username: "trabajador", password: "Segura123!", rol: "trabajador" });
    expect(resultado.status).toBe(400);
    expect(resultado.avanzo).toBe(false);
  });
});

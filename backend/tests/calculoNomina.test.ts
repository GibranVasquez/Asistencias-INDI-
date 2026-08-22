import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularNomina } from "../src/services/calculoNomina";

const decimal = (valor: string | number) => new Prisma.Decimal(valor);

function entradas(overrides: Partial<Parameters<typeof calcularNomina>[0]> = {}) {
  return {
    sueldoBase: decimal("700"),
    diasLaborados: 7,
    viaticosSemanal: decimal("0"),
    viaticosMensual: decimal("0"),
    infonavitDescuento: decimal("0"),
    descuentosVarios: decimal("0"),
    aguinaldo: null,
    montoHorasExtra: decimal("0"),
    ...overrides,
  };
}

describe("calcularNomina", () => {
  it("mantiene la fórmula base con conceptos cero", () => {
    const resultado = calcularNomina(entradas({ diasLaborados: 3 }));
    expect(resultado.montoSueldo.toString()).toBe("300");
    expect(resultado.devengado.toString()).toBe("300");
    expect(resultado.descontado.toString()).toBe("0");
    expect(resultado.totalAPagar.toString()).toBe("300");
  });

  it("preserva Decimal en horas extra, percepciones y deducciones", () => {
    const resultado = calcularNomina(entradas({
      sueldoBase: decimal("100.1"),
      montoHorasExtra: decimal("9.99"),
      viaticosSemanal: decimal("0.1"),
      descuentosVarios: decimal("0.2"),
    }));
    expect(resultado.montoSueldo.toFixed(2)).toBe("100.10");
    expect(resultado.devengado.toFixed(2)).toBe("110.19");
    expect(resultado.descontado.toFixed(2)).toBe("0.20");
    expect(resultado.totalAPagar.toFixed(2)).toBe("109.99");
  });

  it("incluye aguinaldo e INFONAVIT sin convertir a number", () => {
    const resultado = calcularNomina(entradas({ aguinaldo: decimal("50.25"), infonavitDescuento: decimal("10.10") }));
    expect(resultado.devengado.toFixed(2)).toBe("750.25");
    expect(resultado.descontado.toFixed(2)).toBe("10.10");
    expect(resultado.totalAPagar.toFixed(2)).toBe("740.15");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const estilos = readFileSync(new URL("../src/renderer/src/styles/theme.css", import.meta.url), "utf8");

describe("política de movimiento accesible", () => {
  it("centraliza el motion y ofrece una transición de contenido", () => {
    expect(estilos).toContain("--motion-fast:");
    expect(estilos).toContain("--motion-normal:");
    expect(estilos).toContain("--ease-standard:");
    expect(estilos).toContain(".page-transition");
  });

  it("neutraliza animaciones decorativas cuando el sistema solicita movimiento reducido", () => {
    const inicio = estilos.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(inicio).toBeGreaterThan(-1);

    const politicaReducida = estilos.slice(inicio);
    expect(politicaReducida).toContain("animation-duration: 0.01ms !important");
    expect(politicaReducida).toContain("animation-iteration-count: 1 !important");
    expect(politicaReducida).toContain("transition-duration: 0.01ms !important");
    expect(politicaReducida).toContain("transform: none !important");
  });

  it("anima la dona y su contador sin timers de JavaScript", () => {
    expect(estilos).toContain("@property --dona-revelado");
    expect(estilos).toContain("@property --dona-valor");
    expect(estilos).toContain("animation: donaDraw 820ms");
    expect(estilos).toContain("counter-reset: dona-porcentaje var(--dona-valor)");
  });
});

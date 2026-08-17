// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ModuleSummary from "@/shared/components/ModuleSummary";

describe("ModuleSummary", () => {
  it("expone contexto y datos reales como una región accesible", () => {
    render(
      <ModuleSummary
        etiqueta="Personal registrado"
        items={[
          { etiqueta: "Total", valor: 137 },
          { etiqueta: "Activos", valor: 128, tono: "ok" },
        ]}
      />
    );

    const resumen = screen.getByRole("region", { name: "Personal registrado" });
    expect(resumen.textContent).toContain("Total");
    expect(resumen.textContent).toContain("137");
    expect(resumen.textContent).toContain("Activos");
    expect(resumen.textContent).toContain("128");
  });
});

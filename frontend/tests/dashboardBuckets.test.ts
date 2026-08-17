import { describe, expect, it } from "vitest";
import { bucketsPorSemanaDelMes } from "@/features/dashboard/dashboardBuckets";

describe("semanas de la gráfica mensual", () => {
  it("marca como futuras las semanas que aún no comienzan", () => {
    const semanas = bucketsPorSemanaDelMes([], new Date(2026, 7, 1), new Date(2026, 7, 10));

    expect(semanas.map((semana) => semana.esFuturo)).toEqual([false, false, true, true, true]);
  });
});

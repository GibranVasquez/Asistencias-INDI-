import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResultadoSincronizacionModal } from "../src/renderer/src/features/terminales/ResultadoSincronizacionModal";

const base = { recibidas: 3, nuevas: 0, duplicadas: 0, errores: 0, detallesErrores: [] };
describe("ResultadoSincronizacionModal", () => {
  it("no muestra detalle cuando no hay errores", () => {
    expect(renderToStaticMarkup(<ResultadoSincronizacionModal resultado={base} onCerrar={vi.fn()} />)).not.toContain("Detalle de errores");
  });
  it("muestra todos los detalles de error", () => {
    const html = renderToStaticMarkup(<ResultadoSincronizacionModal resultado={{ ...base, errores: 3, detallesErrores: [{ trabajadorExternoId: "900000", codigo: "TRABAJADOR_NO_ENCONTRADO", mensaje: "No existe" }, { trabajadorExternoId: "900001", codigo: "FECHA_HORA_INVALIDA", mensaje: "Fecha inválida" }, { trabajadorExternoId: "900002", codigo: "ERROR_INGESTA", mensaje: "No se pudo registrar" }] }} onCerrar={vi.fn()} />);
    expect(html).toContain("Detalle de errores");
    expect(html.match(/role="listitem"/g)?.length).toBe(3);
    expect(html).toContain("900000"); expect(html).toContain("TRABAJADOR_NO_ENCONTRADO"); expect(html).toContain("No existe");
  });
  it("tolera detalles vacíos aunque haya errores", () => {
    expect(renderToStaticMarkup(<ResultadoSincronizacionModal resultado={{ ...base, errores: 3 }} onCerrar={vi.fn()} />)).toContain("Errores: 3");
  });
});

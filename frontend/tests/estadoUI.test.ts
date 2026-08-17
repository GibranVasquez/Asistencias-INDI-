import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  guardarRutaPersistida,
  guardarSidebarContraido,
  leerRutaPersistida,
  leerSidebarContraido,
  limpiarEstadoUI,
} from "@/core/config/estadoUI";

function almacenamientoMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (indice) => [...datos.keys()][indice] ?? null,
    removeItem: (clave) => { datos.delete(clave); },
    setItem: (clave, valor) => { datos.set(clave, valor); },
  };
}

describe("preferencia visual del sidebar", () => {
  beforeEach(() => vi.stubGlobal("localStorage", almacenamientoMemoria()));

  it("inicia expandido y conserva ambos estados explícitos", () => {
    expect(leerSidebarContraido()).toBe(false);
    guardarSidebarContraido(true);
    expect(leerSidebarContraido()).toBe(true);
    guardarSidebarContraido(false);
    expect(leerSidebarContraido()).toBe(false);
  });

  it("no mezcla la preferencia visual con la ruta ni la sesión", () => {
    guardarRutaPersistida("/panel/trabajadores");
    guardarSidebarContraido(true);
    limpiarEstadoUI();

    expect(leerRutaPersistida()).toBeNull();
    expect(leerSidebarContraido()).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  CLAVE_SESION_TERMINAL_LEGACY,
  crearPersistenciaSesionTerminal,
  SesionTerminal,
} from "@/features/kiosco/terminalSession";

const sesion: SesionTerminal = {
  token: "jwt-de-prueba-no-real",
  terminal: { id: "terminal-1", nombre: "Kiosco QA", tipo: "kiosco" },
};

function dependencias(valor: string | null = null) {
  const puente = {
    guardar: vi.fn().mockResolvedValue(undefined),
    leer: vi.fn().mockResolvedValue(valor),
    borrar: vi.fn().mockResolvedValue(undefined),
  };
  const almacenamiento = { removeItem: vi.fn(), setItem: vi.fn() };
  return { puente, almacenamiento };
}

describe("persistencia segura de sesión Terminal", () => {
  it("guarda el JWT únicamente mediante el puente seguro", async () => {
    const { puente, almacenamiento } = dependencias();
    await crearPersistenciaSesionTerminal(puente, almacenamiento).guardar(sesion);
    expect(puente.guardar).toHaveBeenCalledWith(JSON.stringify(sesion));
    expect(almacenamiento.setItem).not.toHaveBeenCalled();
  });

  it("restaura la sesión cifrada y elimina cualquier clave heredada", async () => {
    const { puente, almacenamiento } = dependencias(JSON.stringify(sesion));
    await expect(crearPersistenciaSesionTerminal(puente, almacenamiento).restaurar()).resolves.toEqual(sesion);
    expect(almacenamiento.removeItem).toHaveBeenCalledWith(CLAVE_SESION_TERMINAL_LEGACY);
  });

  it("borra la sesión segura y la clave heredada al desvincular", async () => {
    const { puente, almacenamiento } = dependencias();
    await crearPersistenciaSesionTerminal(puente, almacenamiento).borrar();
    expect(puente.borrar).toHaveBeenCalledOnce();
    expect(almacenamiento.removeItem).toHaveBeenCalledWith(CLAVE_SESION_TERMINAL_LEGACY);
  });

  it("descarta una sesión segura corrupta", async () => {
    const { puente, almacenamiento } = dependencias("contenido-invalido");
    await expect(crearPersistenciaSesionTerminal(puente, almacenamiento).restaurar()).resolves.toBeNull();
    expect(puente.borrar).toHaveBeenCalledOnce();
  });

  it("falla sin guardar en texto plano cuando el almacenamiento seguro rechaza", async () => {
    const { puente, almacenamiento } = dependencias();
    puente.guardar.mockRejectedValueOnce(new Error("safeStorage no disponible"));
    await expect(crearPersistenciaSesionTerminal(puente, almacenamiento).guardar(sesion)).rejects.toThrow();
    expect(almacenamiento.setItem).not.toHaveBeenCalled();
  });
});

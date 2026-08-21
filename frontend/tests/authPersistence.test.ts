// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actualizarUsuarioEnSesion,
  esPersistenciaDegradada,
  restaurarSesionHumana,
} from "@/features/auth/ContextoAutenticacion";
import { guardarRutaPersistida, leerRutaPersistida } from "@/core/config/estadoUI";

function almacenamientoMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; }, clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (indice) => [...datos.keys()][indice] ?? null,
    removeItem: (clave) => { datos.delete(clave); },
    setItem: (clave, valor) => { datos.set(clave, valor); },
  };
}

const usuarioRh = {
  id: "usuario-test",
  username: "rh-test",
  rol: "rh" as const,
  activo: true,
  trabajadorId: null,
  requiereCambioPassword: false,
  seccionesAsignadas: [],
};

describe("estado visible de persistencia de sesión humana", () => {
  beforeEach(() => vi.stubGlobal("localStorage", almacenamientoMemoria()));

  it("no trata una sesión deliberadamente efímera como un fallo de safeStorage", () => {
    expect(esPersistenciaDegradada(false, false)).toBe(false);
  });

  it("advierte cuando Recordarme fue solicitado pero no pudo persistirse", () => {
    expect(esPersistenciaDegradada(true, false)).toBe(true);
  });

  it("no advierte cuando Recordarme quedó cifrado correctamente", () => {
    expect(esPersistenciaDegradada(true, true)).toBe(false);
  });

  it("actualiza el usuario sin mutar la sesión que después se persiste", () => {
    const original = { token: "token-test", usuario: usuarioRh };
    const actualizada = actualizarUsuarioEnSesion(original, { requiereCambioPassword: true });

    expect(actualizada).toEqual({
      token: "token-test",
      usuario: { ...usuarioRh, requiereCambioPassword: true },
    });
    expect(actualizada).not.toBe(original);
    expect(actualizada?.usuario).not.toBe(original.usuario);
    expect(original.usuario.requiereCambioPassword).toBe(false);
  });

  it("un arranque sin sesión limpia la ruta anterior y termina desautenticado", async () => {
    guardarRutaPersistida("/panel/trabajadores");
    const resultado = await restaurarSesionHumana({ leer: async () => null, borrar: vi.fn() });
    expect(resultado).toEqual({ sesion: null, persistida: null });
    expect(leerRutaPersistida()).toBeNull();
  });

  it("Recordarme restaura el usuario y rol validados por el backend", async () => {
    const resultado = await restaurarSesionHumana(
      {
        leer: async () => ({ valor: JSON.stringify({ token: "token-test", usuario: { ...usuarioRh, rol: "administrador" } }), persistida: true }),
        borrar: vi.fn(),
      },
      async (token) => ({ usuario: { ...usuarioRh, username: `${token}-validado` } })
    );
    expect(resultado.sesion?.usuario.rol).toBe("rh");
    expect(resultado.sesion?.usuario.username).toBe("token-test-validado");
    expect(resultado.persistida).toBe(true);
  });

  it("un token rechazado borra sesión y ruta sin conservar identidad parcial", async () => {
    guardarRutaPersistida("/panel/usuarios");
    const borrar = vi.fn(async () => {});
    const resultado = await restaurarSesionHumana(
      { leer: async () => ({ valor: JSON.stringify({ token: "expirado", usuario: usuarioRh }), persistida: true }), borrar },
      async () => { throw new Error("401"); }
    );
    expect(resultado.sesion).toBeNull();
    expect(borrar).toHaveBeenCalledOnce();
    expect(leerRutaPersistida()).toBeNull();
  });
});

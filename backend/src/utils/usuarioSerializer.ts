import { Seccion, Usuario } from "@prisma/client";

/**
 * Shape pública del usuario expuesta al frontend. Lista explícita de claves:
 * agregar un campo a `Usuario` (ej. passwordHash) nunca se filtra por accidente,
 * porque este serializador solo copia lo que aparece aquí.
 */
export interface UsuarioPublico {
  id: string;
  username: string;
  rol: string;
  activo: boolean;
  trabajadorId: string | null;
}

export function serializarUsuario(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    username: usuario.username,
    rol: usuario.rol,
    activo: usuario.activo,
    trabajadorId: usuario.trabajadorId,
  };
}

// Variante para login/usuario-actual: un encargado_seccion no tiene forma de
// leer GET /secciones (rol=rh) para saber cuáles secciones administra —
// se le informa aquí, sobre sí mismo, en vez de abrirle el catálogo completo.
export interface UsuarioPublicoConSecciones extends UsuarioPublico {
  seccionesAsignadas: { id: string; nombre: string }[];
}

export function serializarUsuarioConSecciones(
  usuario: Usuario & { seccionesAsignadas: Pick<Seccion, "id" | "nombre">[] }
): UsuarioPublicoConSecciones {
  return {
    ...serializarUsuario(usuario),
    seccionesAsignadas: usuario.seccionesAsignadas.map((s) => ({ id: s.id, nombre: s.nombre })),
  };
}

import { Prisma } from "@prisma/client";
import { AppError } from "./AppError";

// Varios services hacen "verificar que no exista ya" (username, numeroSerie,
// numeroChecador, nombre de categoria/seccion, vigenteDesde de tarifa, la
// combinacion trabajadorId+periodoInicio de una nomina) ANTES del
// create/update real, fuera de una transaccion — dos requests casi
// simultaneos (doble clic, dos pestanas de RH) pueden ambos pasar ese
// chequeo y chocar contra la restriccion @unique/@@unique real de Postgres,
// y sin esto el segundo terminaba en un 500 generico (PrismaClientKnownRequestError
// P2002 sin capturar) en vez del 409 con mensaje claro que el chequeo previo
// sí da en el caso comun (sin carrera). El chequeo previo se conserva (mejor
// experiencia: falla antes de intentar el create/update) — esto es el
// respaldo real para la ventana de carrera que ese chequeo no puede cerrar
// por si solo, sin necesitar mover cada caso a una transaccion.
export async function conManejoDeUnicidad<T>(operacion: () => Promise<T>, mensaje: string): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, mensaje);
    }
    throw error;
  }
}

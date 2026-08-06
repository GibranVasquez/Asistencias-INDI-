/// <reference types="node" />
// La referencia de arriba es solo para el editor: prisma.config.ts queda
// fuera del "include" de tsconfig.json a propósito (ver ese archivo), así
// que Cursor/VS Code no encuentran un tsconfig que lo cubra y caen a su modo
// de archivo huérfano (sin libs de Node) — de ahí el falso "no se encuentra
// process" en el editor. tsconfig.prisma.json (npm run typecheck:prisma) ya
// resuelve esto bien vía CLI; esta línea solo evita el subrayado rojo aquí.
// { quiet: true }: sin esto, dotenv 17+ imprime "injected env (N) from
// .env // tip: ..." a stdout por defecto en CADA comando de Prisma CLI
// (migrate/generate/studio) — no incluye ningún valor real, pero es la
// misma librería que estaba activa (aunque no la causa directa) cuando una
// contraseña real de Supabase quedó expuesta en la terminal 2026-08-05 al
// capturar la URL de conexión con un script ad-hoc (ver CLAUDE.md, sección
// Environment). Suprimir este ruido por completo, en vez de dejarlo
// "silencioso pero presente", evita que alguien vuelva a mezclarlo sin
// querer con un script que sí imprime la URL real.
import { config as cargarDotenv } from "dotenv";
cargarDotenv({ quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // No default: si falta, los comandos de Prisma CLI (migrate/generate)
    // fallan de inmediato con un error claro de conexión. El servidor Express
    // valida esta misma variable por separado en config/env.ts.
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL!,
  },
});

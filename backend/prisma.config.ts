import "dotenv/config";
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

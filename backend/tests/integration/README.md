# Integración con PostgreSQL aislado

Esta suite usa exclusivamente PostgreSQL local en
`127.0.0.1:55432/indi_test`, con usuario `indi_test`. El runner rechaza una
`DATABASE_URL` distinta antes de ejecutar Prisma y el cliente repite esa
validación. No usa `migrate reset`: aplica migraciones con `migrate deploy` y
limpia únicamente las tablas de la base efímera entre escenarios.

```bash
cd backend
npm run test:db:up
npm run test:integration
npm run test:db:down
```

El contenedor guarda PostgreSQL en `tmpfs`, no publica fuera de loopback y no
requiere secretos. `test:db:down` elimina solo el contenedor del proyecto
Compose `indi-integration-test`; los datos desaparecen al detenerlo.

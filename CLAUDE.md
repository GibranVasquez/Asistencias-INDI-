# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sistema INDI de Asistencia y Nómina — biometric attendance and payroll system for the
Tren Golfo de México construction site (Grupo INDI). Two parts in this repo:

- `backend/`: Node.js + TypeScript + Express 5 + Prisma, targeting Postgres.
- `frontend/`: Electron + React 19 + TypeScript + `electron-vite`, started
  2026-07-21. Visual reference is a mockup (`App INDI Asistencia.dc.html`,
  not committed to the repo) — tokens/colors/animations ported to
  `frontend/src/renderer/src/styles/theme.css`.

Commands below are grouped per package; run them from that package's directory.

## Backend commands

```bash
npm run dev              # ts-node-dev, auto-restart on change
npm run build             # tsc -> dist/ (solo src/, ver nota de rootDir abajo)
npm start                 # run compiled dist/index.js
npm run typecheck:prisma  # tsc --noEmit aparte para prisma.config.ts + prisma/seed.ts
npm run prisma:generate   # regenerate Prisma client after schema changes
npm run prisma:migrate    # prisma migrate dev (creates + applies a migration)
npm run prisma:studio     # Prisma Studio GUI
npm run seed               # ts-node prisma/seed.ts
```

There is no test suite or lint config yet. `tsc` (via `npm run build`) is the
main form of static verification, pero solo cubre `src/**/*.ts`: `rootDir`
en `tsconfig.json` es `"src"` (no `"."`) para que `dist/` espeje `src/` 1:1
y `dist/index.js` exista donde `"start"` lo espera — antes, con
`rootDir: "."`, `tsc` compilaba a `dist/src/index.js` y `npm start` fallaba
con "Cannot find module" (mismo criterio de `rootDir` que
`Control_Grupo_INDIv2/backend`, el proyecto de referencia). Consecuencia:
`prisma.config.ts` y `prisma/seed.ts` quedan fuera de ese `include`, así
que tienen su propio chequeo de tipos aparte, `tsconfig.prisma.json`
(`npm run typecheck:prisma`) — no se integra al build principal a
propósito, pero sí hay que correrlo manualmente si se tocan esos dos
archivos.

### Environment

Copy `backend/.env.example` to `backend/.env`. Required at boot (validated in
`src/config/env.ts`, process exits with a clear message if missing):
`DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGIN`. `ADMIN_SEED_USERNAME` /
`ADMIN_SEED_PASSWORD` are required only by `prisma/seed.ts` (first-run admin
account; the seed never overwrites an existing user's password).

**Postgres vive en Supabase** (proyecto administrado), no en un Postgres
local — desde 2026-07-24. Dos variables de conexión, no una:
`DATABASE_URL` (pooled, pgbouncer, puerto 6543 — la usa la app en runtime
vía `@prisma/adapter-pg`) y `DIRECT_URL` (conexión directa, puerto 5432 —
la usa solo el motor de migraciones de Prisma; pgbouncer en modo
transacción no soporta los prepared statements que `migrate deploy`
necesita). Ambas están declaradas en el `datasource` de `schema.prisma` y
en `prisma.config.ts`. Nada más cambió: sigue siendo el mismo Express +
Prisma + JWT propio de siempre — Supabase aquí es únicamente el proveedor
del Postgres, no su Auth, ni sus políticas RLS, ni su SDK.

**Región del proyecto de Supabase: `us-east-1` (AWS, N. Virginia, EE.UU.)**
— visible en el host de ambas connection strings
(`aws-0-us-east-1.pooler.supabase.com`). Relevante para cuando se retome
la conversación pendiente de cumplimiento legal sobre dónde vive el dato
biométrico (ver "Bloqueado" más abajo): hoy ese dato vive físicamente en
EE.UU., no en México.

Cosas a tener en cuenta si vuelves a tocar la conexión:
- Si la contraseña de la base tiene caracteres especiales (`#`, `@`, etc.),
  debe ir URL-encoded dentro de la connection string o el parseo de la URL
  se rompe silenciosamente (un `#` sin encodear, por ejemplo, trunca todo
  lo que sigue como si fuera un fragment de URL).
- `src/utils/prisma.ts` fuerza `ssl: { rejectUnauthorized: true, ca: ... }`
  en el adaptador, pinneando `certs/supabase-root-2021-ca.pem` ("Supabase
  Root 2021 CA") como ancla de confianza explícita — el pooler de Supabase
  presenta una cadena firmada por esa CA privada, que no está en el
  almacén de CAs por default de Node, así que sin pinnearla
  `rejectUnauthorized: true` solo falla con "self-signed certificate in
  certificate chain". Es información pública (una CA raíz, no una
  credencial), extraída y verificada contra la cadena real del pooler
  (`openssl s_client -showcerts` + `openssl verify`) — no es un archivo de
  terceros sin auditar, y sigue siendo válida contra ambos endpoints
  (pooled y directo) porque los dos cuelgan de la misma CA. Verificado con
  una prueba negativa real: sustituir ese `.pem` por un CA real pero de
  otra autoridad (Google Trust Services) hace que la conexión falle con el
  mismo error de validación de cadena — confirma que sí se está validando
  de verdad, no ignorando el chequeo.
- La ruta al `.pem` se resuelve con `__dirname` (no `process.cwd()`, que
  depende de desde dónde se lanza el proceso, no de dónde vive el
  archivo — se rompería con un gestor de procesos o contenedor que use un
  working directory distinto a `backend/`). Con `rootDir: "src"` en
  `tsconfig.json` (ver más abajo), `dist/` espeja `src/` 1:1, así que este
  archivo vive en `src/utils/` en dev y en `dist/utils/` en el build
  compilado — misma profundidad relativa a `backend/` en los dos casos,
  por eso `../../certs/...` desde `__dirname` llega a `backend/certs/` en
  ambos entornos sin necesitar detectar en cuál se está corriendo.
- **`DATABASE_URL` NUNCA debe llevar `?sslmode=require` cuando el código ya
  pasa un `ssl: { ca: ... }` explícito — bug real encontrado en producción
  2026-07-30, distinto del CA fijo.** La versión instalada de
  `pg-connection-string` trata `sslmode=require` como alias de
  `verify-full` (cambio de comportamiento que la propia librería avisa por
  warning en runtime) — combinado con un `ssl` explícito en código, termina
  validando la cadena contra el almacén de CAs por default de Node en vez
  de contra el CA pinneado, fallando con el mismo "self-signed certificate
  in certificate chain" aunque el CA correcto sí se esté leyendo y pasando
  bien. Aislado con una prueba mínima usando `pg` puro (sin Prisma): la
  misma `connectionString` + `ssl` explícito conecta bien sin ese
  parámetro, y falla con él. `infra/terraform/secrets.tf` ya no lo incluye
  en la `DATABASE_URL` que arma para RDS — pendiente real: `backend/.env.example`
  todavía documenta `?sslmode=require` para Supabase, mismo riesgo latente
  ahí, no corregido todavía por estar fuera del alcance urgente de este
  hallazgo.
- **El CLI de Prisma (`prisma migrate deploy`) NUNCA validó el CA de RDS
  — confirmado en vivo 2026-07-30, y es un problema distinto del anterior.**
  El motor de migraciones es Rust, no pasa por el `ssl: { ca: ... }`
  explícito de `src/utils/prisma.ts` (eso es código JS de la app en
  runtime) — el CLI solo lee lo que traiga la propia connection string. Un
  `DATABASE_URL`/`DIRECT_URL` con solo `?sslmode=require` (el patrón
  usado hasta ahora para correr migraciones/`psql` manual contra RDS vía
  el túnel del bastión) cifra la conexión pero no autentica al servidor en
  absoluto. Confirmado con la misma prueba positiva/negativa que ya se
  hizo para Supabase: `sslrootcert` equivocado contra RDS → falla
  explícito ("certificate verify failed"); el correcto
  (`rds-global-bundle.pem`) → conecta bien. Corrección documentada en
  `infra/AWS_MIGRATION.md` (sección 6): usar
  `sslmode=verify-full&sslrootcert=<ruta>/rds-global-bundle.pem` al
  conectar directo al endpoint real de RDS (`verify-ca` en vez de
  `verify-full` si se conecta vía `localhost` del túnel SSM, ya que el
  hostname del túnel no coincide con el del certificado real). No hay
  ningún secret/recurso de Terraform que corregir aquí — `DIRECT_URL`
  para uso de CLI siempre se teclea manualmente en la máquina de
  desarrollo, nunca queda guardado; el fix es puramente de documentación
  para que la próxima vez se use el parámetro correcto desde el inicio.

### Despliegue (Railway)

Preparado pero **no conectado todavía** (ver "Bloqueado" más abajo — el
despliegue real sigue pendiente). `PORT` ya se lee de `process.env.PORT`
(con fallback a 4000 solo para dev local); `GET /health` existe y está
excluido del rate limiter general para que un healthcheck de
infraestructura no cuente contra el cupo de un usuario/IP real.

**Migraciones: manuales, no automáticas en el build/release de Railway.**
Se corre `npx prisma migrate deploy` desde una máquina de desarrollo
apuntando a la base de producción (Supabase) — mismo patrón que se usó
para la migración inicial a Supabase — y Railway solo arranca el server
ya migrado. Decisión explícita, no la única opción: automatizarlo
(`"start": "prisma migrate deploy && node dist/index.js"` en Railway) es
más cómodo y evita el riesgo de "se me olvidó correrla", pero como este es
el primer despliegue real del proyecto (sin ambiente de staging donde
probar el pipeline primero), se prefirió mantener el control manual por
ahora. Si el proyecto crece (más gente tocando el schema, deploys más
frecuentes), vale la pena reconsiderar esto.

**Checklist antes de cada deploy que incluya una migración nueva:**
1. Correr `npx prisma migrate deploy` desde tu máquina (con `.env` apuntando
   a `DATABASE_URL`/`DIRECT_URL` de producción) — **antes** de hacer push
   del código que depende del schema nuevo.
2. Confirmar que corrió limpio (`Database schema is up to date!`) antes de
   dejar que Railway despliegue el código.

**Variables de entorno a configurar en Railway** (`src/config/env.ts` +
grep de `process.env` en `src/`): `DATABASE_URL`, `JWT_SECRET`,
`ALLOWED_ORIGIN` (requeridas al boot); `NODE_ENV=production` (no la exige
`env.ts`, pero gatea los rate limits estrictos en `middlewares/rateLimit.ts`
— sin ponerla, el server corre con los límites pensados para desarrollo);
`JWT_EXPIRES_IN` (opcional, default `"8h"`), `JWT_EXPIRES_IN_TERMINAL`
(opcional, default `"30d"`). **`ADMS_IPS_PERMITIDAS` requerida en
producción si el lector ADMS de oficina va a usarse** (ver sección ADMS
arriba) — sin ella, `NODE_ENV=production` hace que `/iclock/*` rechace
todo por diseño (fail-closed), no es opcional como las demás. **`DIRECT_URL`
no hace falta en Railway** con el flujo manual de arriba — solo la usa la
CLI de Prisma desde la máquina de desarrollo, nunca el proceso Express en
runtime.

**CORS y clientes Electron:** `ALLOWED_ORIGIN` no protege al cliente de
escritorio real. Verificado empíricamente (build empaquetado real,
`file://`, sin dev server): un fetch desde ahí no manda header `Origin` en
absoluto, así que el navegador (Chromium embebido) no tiene nada contra
qué comparar la respuesta — no aplica ninguna restricción sin importar el
valor configurado. El middleware `cors` con un string fijo en `origin`
tampoco valida nada del lado servidor: siempre responde con ese mismo
valor en `Access-Control-Allow-Origin`, sea cual sea el `Origin` entrante
(ver `node_modules/cors/lib/index.js`, función `configureOrigin`) — es el
navegador quien hace el bloqueo real. Esta variable solo importa como
defensa-en-profundidad contra un navegador de verdad accediendo a la API
(no hay ningún cliente web legítimo en producción); un valor que nunca
vaya a coincidir con un origen real basta.

## Architecture

Layered Express app, one direction of dependency only:
`routes -> middlewares -> controllers -> services -> prisma`.

- **`src/routes/`** wires URL + HTTP method + middleware chain to a controller
  function. `src/routes/index.ts` mounts feature routers (e.g. `/auth`) under
  the root router.
- **`src/controllers/`** are thin: pull data off `req`, call one service
  function, `res.json(...)` the result. No business logic, no try/catch —
  Express 5 forwards rejected promises from async handlers straight to
  `errorHandler` automatically.
- **`src/services/`** hold business logic and validation. On failure they
  `throw new AppError(status, message)`; that's the only expected error type
  a controller has to worry about.
- **`src/middlewares/errorHandler.ts`** is the last `app.use()` in `app.ts`. It
  special-cases `AppError` (uses its `status`/`message`); anything else
  becomes a generic 500, with the real message only exposed when
  `NODE_ENV !== "production"`.
- **`src/utils/prisma.ts`** exports a singleton `PrismaClient` built with
  `@prisma/adapter-pg`, reused everywhere instead of instantiating per-request.
- **Serializers** (e.g. `utils/usuarioSerializer.ts`) are explicit allow-lists
  of fields returned to the client, so a new sensitive Prisma column (like
  `passwordHash`) is never leaked just because it got added to the model.

### Auth

- JWT (`jsonwebtoken`) + bcrypt. `authMiddleware` reads `Authorization: Bearer
  <token>`, verifies, and attaches `req.user` (typed via `types/auth.ts` +
  the global `Express.Request` augmentation in `types/express.d.ts`).
  Rejections always return the same generic 401 to the client; the real
  reason (expired token, malformed header, etc.) only goes to
  `console.warn` server-side.
- `permitirRoles(...roles)` (`middlewares/role.middleware.ts`) gates routes by
  `RolUsuario`: 401 if `req.user` is missing (auth middleware didn't run),
  403 if the role isn't in the allowed list.
- Login (`services/auth.service.ts`) mitigates username-enumeration via
  timing: when the username doesn't exist, `bcrypt.compare` still runs
  against a fixed dummy hash (`HASH_SENUELO`) so response time doesn't
  differ. Same generic message/status for "no such user" and "wrong
  password".
- `express-rate-limit` (`middlewares/rateLimit.ts`): `limitadorGlobal` keys
  by authenticated usuario/terminal (falls back to IP only when
  unauthenticated) — otherwise RH+recepción+encargado+kiosco sharing one
  office IP would share a single quota. 300/15min in production, 2000 in
  dev (StrictMode/E2E traffic). `limitadorLogin` is IP-keyed (no identity
  yet at that point): 5/15min in production, 50 outside it.
- **Password policy** (`utils/validacion.ts`,
  `validarFortalezaPassword`): min 8 characters, at least one letter, one
  number. Enforced in the 3 places a password gets set — account creation
  (`validarAltaUsuario`), self change (`validarCambioPropiaPassword`),
  admin reset (`validarReseteoPassword`) — never re-checked in the service
  layer (same convention as `esUUID`/`esFechaISO`: format checks live in
  middlewares, not services). Write-time only, not retroactive: login just
  does `bcrypt.compare` against whatever hash already exists, so the 4
  seeded accounts (`admin`/`rh1`/`recepcion1`/`encargado_topografia`, the
  last 3 on `"1234"`, which fails this policy) still log in fine after
  adding it — confirmed live, all 4 — and will keep working until/unless
  someone actually changes/resets that password, at which point the new
  value has to comply.
- **Account lockout** (`Usuario.intentosFallidos`/`bloqueadoHasta`,
  `auth.service.ts`): 5 consecutive failed logins lock that specific
  account for 15 minutes, regardless of source IP — independent of (and a
  narrower defense than) the IP/identity-based rate limiter above, since it
  blocks the *account* even if an attacker spreads attempts across many
  IPs. A locked account gets a distinct 423 with the message and minutes
  remaining, not the generic 401 — deliberately reveals the account exists
  (unlike the 401 case), a explicit trade-off for clearer UX during
  lockout. Resets to 0 on successful login. If the previous lockout window
  already expired, the very next failed attempt starts a fresh count of 1
  instead of instantly re-triggering the lock (otherwise a single typo
  right after unlock would immediately re-lock the account, since the
  counter was still sitting at the threshold). The lockout itself is
  logged to `AuditLog` (`bloquear_cuenta_por_intentos_fallidos`).
- **Known gap: the 423 is a username-enumeration oracle, not closed,
  just accepted for now.** Confirmed empirically: a nonexistent username
  always gets the generic 401 (never 423, `bloqueadoHasta` only exists on
  real rows), so an attacker who fires ≥5 wrong-password attempts against
  a candidate username and sees 423 on the next one has confirmed that
  account exists — 6 requests to de-anonymize one username, distinct from
  (and not mitigated by) the timing-safe `HASH_SENUELO` comparison above,
  which only protects the single-request 401-vs-401 case. Accepted
  deliberately for now: this is a small system with a handful of known
  internal accounts, not a public signup surface — revisit (e.g. collapse
  423 back to a generic 401, or add a random jittered delay) if the
  backend ever becomes more exposed (public internet, larger/unknown user
  base).
- **Logging out does not invalidate the JWT server-side.** Confirmed by
  reading the code (no `/auth/logout` route, no revocation/blacklist table
  in `schema.prisma`, `authMiddleware` only checks signature + expiry) and
  empirically (grabbed a token, simulated logout — nothing server-side
  changes — then reused that exact token against `GET
  /auth/usuario-actual`: still `200 OK`). This applies the same way
  whether "logging out" was the manual sidebar button or the 30-minute
  inactivity timeout below — both are purely client-side (delete the
  locally stored token; see `AuthContext.cerrarSesion`). Conscious
  trade-off of stateless JWT, not an oversight: a copied/stolen token
  stays valid until its own natural expiry (`JWT_EXPIRES_IN`, 8h for
  humans) regardless of what the visual session state does. No revocation
  list is planned for now — would need a stateful store (Redis, or a DB
  table checked on every request) that this system doesn't have yet;
  revisit if a real "someone's token got compromised, kill it now" need
  ever comes up.
- **JWT expiry, split by token type**: `JWT_EXPIRES_IN` (default `"8h"`,
  `auth.service.ts`) for human Usuario sessions vs. `JWT_EXPIRES_IN_TERMINAL`
  (default `"30d"`, `terminalAuth.service.ts`) for Terminal/kiosk sessions
  — a kiosk is an unattended physical device with no one around to
  re-type credentials when it expires, so it shouldn't churn at the same
  rate as a human's session. The frontend separately auto-logs out a human
  session after 30 minutes of *inactivity* (see Frontend section) — a
  distinct, shorter, client-side mechanism layered on top of the token's
  own absolute expiry, not a replacement for it.
- **`Terminal` tipo="adms" cannot log in via `/auth/login-terminal` —
  fixed 2026-07-27, was a real IP-allowlist bypass, not just a latent
  gap.** `iniciarSesionTerminal` used to authenticate ANY `Terminal` row
  purely by username+password, regardless of `tipo` — it never checked
  whether that terminal was actually meant to hold a JWT session. The
  ADMS reader (`tipo="adms"`) is protected by `restringirPorIP.ts` on its
  own protocol (`/iclock/*`), but that protection is entirely bypassed if
  the same credentials can instead go through `/auth/login-terminal` and
  get a normal 30-day Terminal JWT — from there, `POST /asistencias` (the
  Kiosco endpoint) would accept fabricated marcaciones as if a real Kiosco
  had sent them, with no IP restriction at all (that endpoint was never
  meant to need one — a Kiosco is JWT-authenticated by design). Closed by
  rejecting login explicitly when `terminal.tipo === "adms"`, checked
  *after* password/`activo` validation (same principle as the rest of
  this file: don't reveal a terminal's type to someone who hasn't proven
  they know its password) — a wrong password still gets the generic 401,
  only a *correct* password against an `adms` terminal gets the specific
  403. Verified live: correct password against the real
  `terminal_mb10vl_oficina` → 403 with the specific message; wrong
  password against it → generic 401 (not the ADMS message); correct
  password against a `tipo="huella"` terminal → 200 with a token,
  unaffected.
- **`Terminal` alta for `tipo="adms"` no longer accepts a caller-supplied
  password — the server generates one.** Since that login path is now
  rejected unconditionally (previous bullet), asking an administrator to
  type a password for it served no real purpose. `crearTerminal`
  (`terminal.service.ts`) generates a random one (`crypto.randomBytes(32)`,
  base64) server-side when `tipo === "adms"`, hashes it the same way as
  any other terminal, and never exposes the plaintext anywhere — not in
  the endpoint's response (`TerminalPublico` never included
  password/hash to begin with) and not in any log.
  `validarAltaTerminal.ts` no longer requires `password` in the request
  body when `tipo === "adms"` (still required for every other type).
  Verified live: `POST /terminales` with `tipo="adms"` and no `password`
  field at all → `201`; the resulting terminal still gets rejected by
  `/auth/login-terminal` regardless of what password is guessed → `401`
  (wrong) or would be `403` (right, but there's no way to know it — it's
  never exposed); a non-`adms` terminal alta without `password` still
  gets the original `400`. No frontend form for creating `Terminal` rows
  exists yet anywhere in the app (checked `UsuariosPage.tsx`, all other
  pages) — every terminal alta so far has gone through the API directly,
  so there was no UI password field to remove.

### Data model (`prisma/schema.prisma`)

Core entities: `Usuario` (system accounts, one per role in `RolUsuario` —
`trabajador | recepcion | encargado_seccion | rh | administrador`;
optionally linked 1:1 to a `Trabajador` for kiosk self-auth), `Trabajador`
(workers — payroll fields like `sueldoBase`/`banco`/`clabe`/`fechaIngreso`
are nullable because biometric-enrollment intake doesn't include them; RH
fills them in later), `Obra`/`Seccion` (site/sections; a worker's section is
recorded per attendance entry, not fixed on the worker), `Horario`
(schedules), `AsistenciaDiaria` (daily attendance punches), `TipoMovimiento`
+ `MovimientoTrabajador` (configurable catalog of leave/status
events — incapacidad, vacaciones, suspensión, etc. — this is the single
source of truth for those states, not `Trabajador.estatus`, which only
tracks `activo | baja | becario`), `NominaSemanal` + `TarifaHoraExtra`
(weekly payroll), `Terminal` (biometric kiosks — includes both JWT-based
kiosks and ADMS-type readers, see the ADMS section below), `AuditLog`,
`EventoNoReconciliado` (marcaciones ADMS cuyo PIN no coincide con ningún
`Trabajador.numeroChecador` — ver sección ADMS).

Conventions used throughout the schema — follow them for any new model:
- `id String @id @db.Uuid @default(dbgenerated("gen_random_uuid()"))` —
  generated by Postgres, not the app or Prisma.
- camelCase Prisma fields mapped to snake_case columns via `@map()`; tables
  via `@@map()` (plural snake_case); enums lowercase Spanish values,
  `@@map()`'d to a snake_case type name.
- Money is `Decimal @db.Decimal(p,s)`; timestamps are
  `DateTime @default(now()) @db.Timestamptz(6)`; date-only fields use
  `@db.Date`.
- `@@index([...], map: "idx_table_field")` on FKs and common filter columns.
- `prisma.config.ts` (not the `datasource` block in `schema.prisma`) is where
  `DATABASE_URL` is read from env for the Prisma CLI; `utils/prisma.ts` does
  the same for the app at runtime via `@prisma/adapter-pg`.

`prisma/seed.ts` is idempotent (`upsert` throughout) and safe to re-run: it
seeds the Obra/Secciones (including "Oficina", added 2026-07-25 for the
ADMS reader — see below), a placeholder office `Horario`, the
`TipoMovimiento` catalog, the real worker roster
(`prisma/seed-data/roster_enrolamiento_tren_golfo.json`), and one account per
role for local testing. `TarifaHoraExtra` is deliberately left unseeded
(no confirmed real value yet).

## Frontend

Electron + React 19 + TypeScript, built with `electron-vite` (not the
`create-electron-vite` scaffolder — hand-rolled config). Commands run from
`frontend/`:

```bash
npm run dev         # electron-vite dev, opens a normal (non-fullscreen) window
npm run build       # electron-vite build -> out/ (does NOT produce an installer yet)
npm run typecheck   # tsc --noEmit against tsconfig.node.json + tsconfig.web.json
```

Launch with `--kiosk` (or `INDI_KIOSK=1`) to boot fullscreen/locked directly
into `/kiosco`, as a physical kiosk device would; without it, opens a normal
window for developing the admin panel.

### Structure

- `src/main/index.ts`: creates the `BrowserWindow`; on Linux, forces the
  `gnome-libsecret` `safeStorage` backend when `XDG_CURRENT_DESKTOP` isn't a
  Chromium-recognized desktop (Hyprland, Sway, i3, etc.) — Chromium's own
  autodetection only checks for gnome/kde/unity/xfce by name and otherwise
  silently falls back to a much weaker `basic_text` backend even when a real
  secrets daemon (gnome-keyring) is running.
- `src/main/secureStore.ts`: IPC handlers (`secure-store:guardar/leer/borrar`)
  backing the admin panel's persisted session — `safeStorage`-encrypted file
  in `app.getPath('userData')` when "Recordarme" is checked; in-memory-only
  (never touches disk) otherwise. If `safeStorage` isn't available at all,
  `AuthContext.iniciarSesion` degrades to an in-memory session rather than
  failing the login.
- `src/preload/index.ts`: exposes `window.indiApp` (`esKiosco` flag +
  `sesionSegura` bridge to the IPC handlers above) — nothing else of
  Electron's API is exposed to the renderer.
- `src/renderer/src/`: the React app. `App.tsx` routes via `HashRouter`
  (required — production loads `file://`, where a normal `BrowserRouter`
  doesn't work). `context/AuthContext.tsx` (human `Usuario` sessions,
  safeStorage-backed) and `context/TerminalContext.tsx` (kiosk `Terminal`
  sessions + local `seccionId`/`turno` config, plain `localStorage` — not
  sensitive the way payroll-adjacent admin sessions are) are separate,
  because a kiosk terminal and a human admin account are unrelated
  credentials against unrelated backend auth flows (`/auth/login` vs
  `/auth/login-terminal`).
- `assets.ts` (`asset(path)`): use for any `public/` image reference —
  `<img src="/assets/x.png">` breaks in the packaged build (`file://`
  resolves a leading `/` against the filesystem root, not `out/renderer/`);
  `asset()` uses `import.meta.env.BASE_URL` instead, which works in both dev
  and the packaged build.
- `hooks/useTimeoutInactividad.ts`: mounted in `layouts/AdminLayout.tsx`
  (30 min), listens for mouse/keyboard/scroll/touch on `window` and calls
  `cerrarSesion()` after that long with none — resetting on every event.
  Purely client-side and independent of the JWT's own absolute expiry (see
  backend Auth section); doesn't run for Kiosco (separate `TerminalContext`
  session, not wrapped by `AdminLayout`), since an unattended kiosk
  shouldn't log itself out for lack of a human standing in front of it.
- `components/PasswordInput.tsx`: shared show/hide-password toggle (eye
  icon) + optional real-time requirements checklist
  (`mostrarRequisitos` prop) mirroring the backend's
  `validarFortalezaPassword` rules — used in `LoginPage`,
  `CambiarPasswordObligatorioPage`, and `UsuariosPage` (create account +
  admin reset). The checklist is advisory only; the actual rejection of a
  weak password always comes from the backend's real validation, never
  blocked client-side before submit.
- `components/AyudaSoporteModal.tsx`: contact info is **placeholder data**
  (`CONTACTO_SOPORTE` constant at the top of that file) — replace with
  Grupo INDI's real support phone/email/hours before real use. Opened from
  a sidebar button in `AdminLayout.tsx` (`Ayuda y soporte`, visible to
  every role, unlike `usuarios`/`configuracion`/`reportes` which are
  role-filtered).

### Kiosco "modo de prueba" — compile-time flag, not a UI toggle

`KioscoPage.tsx`'s manual trabajadorId input (temporary stand-in for the
Horus E1-FP biometric reader, not built yet) is gated by
`import.meta.env.VITE_ENABLE_MODO_PRUEBA === "true"`, a Vite env var that's
statically inlined at build time — when false/absent, the button is
`disabled` and the whole form is dead-code-eliminated from the bundle, not
just hidden. That var lives **only** in `.env.development` (loaded by
`electron-vite dev`, never by `electron-vite build`), so a production build
can't ship it by accident. Don't add it to `.env`/`.env.example`.

### Terminal read access to catalogs

A `Terminal` JWT (kiosk device) and a `Usuario` JWT (human) are structurally
different payloads (`terminalId` vs `usuarioId`+`rol`) verified by different
middlewares — a Terminal token cannot pass `authMiddleware` at all, so it
can never reach a `rol=rh`-gated route. `GET /secciones` and `GET /horarios`
are the one exception: they're mounted with
`permitirTerminalOUsuarioConRol(...)` (backend,
`middlewares/authTerminalOUsuario.ts`) so the kiosk can populate its
sección/turno config from live data instead of a hardcoded value — every
other verb on those routers (`POST`/`PATCH`/`DELETE`) is still strictly
`rol=rh` only.

### ADMS — lector biométrico ZKTeco MB10-VL (oficina)

Segunda fuente de asistencia, distinta del Kiosco Electron: un equipo
físico de fábrica (Linux + firmware propio de ZKTeco, el trabajador nunca
ve nuestra app) que sincroniza vía el protocolo **ADMS** ("push protocol")
sobre HTTP plano. Preparado y probado con peticiones ADMS simuladas
(`curl`, imitando el formato real) — **no verificado todavía contra el
equipo físico**, que no está conectado aún (ver "Bloqueado" más abajo).

**El protocolo no tiene spec pública oficial** — lo que sigue está
reconstruido de varias implementaciones de terceros (Go, PHP, colecciones
de Postman), no de documentación de ZKTeco:

- `GET /iclock/cdata?SN=<serie>&options=all` — handshake al conectar.
  Responde texto plano (no JSON) con `ATTLOGStamp`/`OPERLOGStamp`/etc. —
  `generarRespuestaHandshake` (`adms.service.ts`) siempre responde `None`
  en esos Stamp ("no he recibido nada"), lo cual es correcto para un
  equipo nuevo, pero si en producción el equipo reconecta seguido podría
  reenviar todo su backlog cada vez. **Precisión sobre qué tan cubierto
  está esto** (verificado en vivo, no solo en teoría): un reenvío del
  mismo backlog **no genera duplicados ni pierde datos** —
  `yaExisteAsistencia` y `yaExisteEventoNoReconciliado` (`adms.service.ts`)
  detectan el mismo PIN+fecha+hora ya procesado sin importar cuántas veces
  se repita, para los dos caminos (reconciliado y no reconciliado).
  Confirmado reenviando el mismo lote ATTLOG 2 y 3 veces seguidas: la
  segunda y tercera vez se cuentan como "duplicados", sin crear filas
  nuevas. Lo único que esto NO evita es procesamiento redundante — si el
  equipo reenvía un backlog grande en cada reconexión, cada línea se
  vuelve a parsear y buscar en BD para confirmar que ya existe (costo de
  eficiencia, no un hueco de integridad de datos). Persistir el último
  Stamp real por terminal evitaría ese costo, pero es una optimización
  pendiente, no una corrección de un bug.
- `POST /iclock/cdata?SN=<serie>&table=ATTLOG&Stamp=<n>` — el equipo
  empuja marcaciones nuevas. Cuerpo tab-separated, una línea por
  marcación: `PIN\tYYYY-MM-DD HH:MM:SS\tstatus\tverify\t...`. `status`
  (entrada/salida) no se usa — este sistema ya calcula eso vía
  sección+horario. `verify` (método) se mapea con `1=huella, 15=rostro`
  (`MAPA_METODO_VERIFY`, `adms.service.ts`) — la convención más citada
  entre las fuentes revisadas, **no confirmada contra el MB10-VL real**;
  un código no mapeado cae a "huella" por default (con `console.warn` del
  código crudo) en vez de perder la marcación.
- `GET /iclock/getrequest` / `POST /iclock/devicecmd` — el equipo
  pregunta por comandos pendientes / confirma haberlos ejecutado. Siempre
  respondemos "no hay nada" — nunca le mandamos comandos al equipo.
- Todas las respuestas son texto plano (`res.type("text/plain")`), nunca
  JSON — por eso este endpoint vive fuera del router JSON normal
  (`src/routes/adms.routes.ts`, montado sin prefijo en
  `src/routes/index.ts`: las rutas `/iclock/*` las fija el firmware, no
  son elegibles de nuestro lado).

**Autenticación: el protocolo no tiene ninguna que este equipo pueda
usar.** Revisado en varias implementaciones de terceros — ni token, ni
API key, ni header de auth. El `SN` (número de serie) viaja en texto
plano y es trivialmente falsificable por cualquiera que lo conozca
(visible en la etiqueta física del equipo). `resolverTerminalPorSN`
(`adms.service.ts`) valida el SN contra `Terminal.numeroSerie` — **esto
NO es autenticación real**, solo confirma "es un equipo que nosotros
dimos de alta".

**Investigado y descartado (2026-07-27): "Comm Key" / `pushcommkey`.**
La especificación del protocolo PUSH de ZKTeco sí documenta un parámetro
`pushcommkey` (32 caracteres hex, en el query string del handshake GET
`/iclock/cdata`) descrito como "ciphertext para vincular cliente y
servidor" — pero el propio documento lo marca opcional ("solo aplica
cuando el cliente lo soporta Y el servidor lo soporta"), y ninguna de
las 3 librerías/SDKs de terceros revisadas lo implementa. Más importante:
**revisado el manual de usuario real del MB10-VL** (y, para descartar que
fuera una omisión de esa página en particular, cruzado contra 2 manuales
más de equipos ZKTeco standalone de la misma familia de firmware) — su
menú `COMM. > Cloud Server Setting` (el que sí configura la conexión
ADMS) únicamente expone `Server Address`, `Server Port`, `Enable Domain
Name`, `Enable Proxy Server` y un toggle `HTTPS` — **ningún campo de
clave/token**. El "Comm Key" que sí existe en ese mismo manual vive bajo
`COMM. > PC Connection`, un ajuste completamente distinto (password de
1-6 dígitos para el protocolo SDK clásico de ZKTeco, típicamente TCP
binario puerto 4370, usado por software tipo ZKAttendance/pyzk) — no
tiene relación con el protocolo ADMS/HTTP que usa `/iclock/*`. Conclusión:
sin acceso al software comercial de ZKTeco (ZKBioAccess/ZKBioTime, que
probablemente sea quien de verdad provisiona `pushcommkey` al emparejar
equipo+servidor), el MB10-VL operado de forma standalone contra un
backend propio **no tiene forma de enviar ningún secreto por request**.
Una idea de respaldo (un valor fijo embebido en el campo `Server
Address`, aprovechando que el modo "Enable Domain Name" acepta algo con
forma de URL) quedó identificada pero **sin verificar** — depende de
cómo el firmware real concatene ese campo, y no se puede probar sin el
equipo físico conectado (ver "Bloqueado" más abajo).

**Bypass real cerrado 2026-07-27: un `Terminal` tipo="adms" ya no puede
autenticarse por `/auth/login-terminal`.** La lista blanca de IP de abajo
solo protege `/iclock/*` — hasta este fix, las mismas credenciales del
terminal ADMS también servían para entrar por la ruta JWT normal de
Kiosco, saltándose esa protección por completo. Ver la sección "Auth"
arriba (`iniciarSesionTerminal`) para el detalle técnico y la
verificación en vivo.

**Mitigación real, explícita, en tres capas** (dado que el equipo no tiene
forma propia de autenticarse — ver el descarte del Comm Key arriba —, IP
es la única mitigación real de bloqueo que existe hoy; se complementa con
detección rápida de fallos, no la reemplaza):

1. **Aplicación** (`middlewares/restringirPorIP.ts`, capa principal):
   `ADMS_IPS_PERMITIDAS` (env var, IPs separadas por coma) — `req.ip` debe
   estar en la lista o se rechaza con 403 antes de llegar siquiera a
   `resolverTerminalPorSN`. Funciona en cualquier plataforma de despliegue
   (Railway o AWS — la decisión entre las dos sigue sin tomarse). **Fail-
   closed en producción**: si `NODE_ENV=production` y la variable no está
   configurada, se rechaza TODO /iclock/* (no se asume "sin lista, dejar
   pasar" como seguro — sin esta capa el endpoint quedaría sin ninguna
   protección real, dado que no hay alternativa de auth para este equipo).
   Fuera de producción, si se omite, no bloquea (para no exigir
   configurarla en cada entorno de desarrollo) — pero si sí está
   configurada, se respeta igual fuera de producción. Requirió
   `app.set("trust proxy", 1)` (`app.ts`) para que `req.ip` refleje al
   cliente real detrás de un proxy administrado (Railway/App Runner), no
   al balanceador — corregido de paso el mismo bug latente en el keying
   por IP del rate limiter general. Verificado en vivo con las 4
   combinaciones (sin configurar en dev, IP configurada que no coincide,
   IP configurada que sí coincide, producción simulada sin configurar) y,
   por separado, con `X-Forwarded-For` spoofeado vía curl para el fix de
   `trust proxy` (prueba positiva: con `trust proxy` activo, `req.ip`
   refleja el header; prueba negativa: desactivándolo temporalmente, el
   header se ignora y `req.ip` vuelve a ser el peer real — confirma que el
   ajuste sí es el que determina el comportamiento).

   *Nota histórica:* el 2026-07-27 esta capa se cambió brevemente a
   "opcional/fail-open en todo ambiente" (razonamiento: evitar que un
   cambio futuro de IP de la oficina bloqueara marcaciones reales sin que
   nadie lo notara) y se revirtió el mismo día — con el Comm Key
   descartado, quitar el único bloqueo real dejaría el endpoint
   completamente abierto. El riesgo original ("la IP cambia y nadie se
   entera") quedó cubierto por la capa 2 de abajo, no por volver esto
   opcional.
2. **Detección: alerta de inactividad en el Dashboard**
   (`frontend/.../pages/DashboardPage.tsx`). Complementa la capa de
   bloqueo, no la reemplaza: si la IP configurada deja de ser correcta
   (cambio de proveedor, etc.) el endpoint volverá a rechazar todo por
   diseño (fail-closed) — lo que esta alerta resuelve es que alguien se
   entere RÁPIDO de que eso pasó, en vez de días después al ver nómina
   rara. `GET /terminales` (rh/administrador) expone
   `Terminal.ultimaSincronizacion` (ya se actualizaba en
   `adms.controller.ts` en cada handshake/subida de datos, pero no se
   exponía); el Dashboard marca como inactivo cualquier `Terminal`
   `tipo="adms"` cuya `ultimaSincronizacion` sea `null` o tenga más de 24h
   (`UMBRAL_HORAS_INACTIVIDAD_ADMS`), y muestra un banner rojo visible
   arriba de las tarjetas KPI. Umbral fijo (no ligado a horario real de
   oficina, que no está modelado de forma reutilizable para este
   propósito). Verificado en vivo con Electron real: terminal ADMS de
   prueba con `ultima_sincronizacion` forzada a 48h atrás → banner visible
   con el nombre del terminal y la fecha exacta; terminal eliminado →
   banner desaparece.
3. **Infraestructura** (`infra/terraform/waf.tf`, capa adicional,
   específica de AWS): un Web ACL de WAF asociado directamente al
   servicio de App Runner (confirmado que esto es posible sin CloudFront
   ni cambiar de arquitectura — un servicio *público* de App Runner sí
   soporta reglas de IP origen vía WAF; la limitación documentada de
   "las reglas de IP no funcionan" aplica solo a servicios *privados* de
   App Runner, no es nuestro caso), bloqueando cualquier request a rutas
   `/iclock/*` que no venga de `var.adms_ips_permitidas`. Esta capa
   protege *todo* el servicio (WAF no puede aplicarse a una sola ruta, la
   regla en sí sí es específica de `/iclock/*` vía un `and_statement`),
   pero solo aplica una vez que exista una cuenta de AWS real y se elija
   esa plataforma sobre Railway — no aplicada todavía, igual que el resto
   de `infra/terraform/`. **Actualización 2026-07-31: el WAF ya está
   activo de verdad**, asociado al ALB real de ECS (no App Runner, migrado
   desde entonces) — confirmado en vivo (`wafv2:GetWebACLForResource`
   contra el ALB real) y probado con una petición real bloqueada desde una
   IP fuera del allowlist (`403`, HTML genérico de bloqueo del WAF).

**Pendiente real, no cerrado hoy (2026-07-31) — logging del WAF a
CloudWatch Logs:** el recurso `aws_wafv2_web_acl_logging_configuration.adms`
(`infra/terraform/waf.tf`) sigue sin poder aplicarse. No es un problema de
código ni de las políticas IAM ya corregidas hoy (`iam-provisioning-policy-compute.json`/`-datos.json`,
ambas sincronizadas y confirmadas) — es un permiso adicional, genuinamente
nuevo, que no se anticipó: `wafv2:PutLoggingConfiguration` internamente
necesita que quien la llama (la identidad de Terraform) también pueda
crear/modificar la política de recurso del log group destino
(`logs:PutResourcePolicy` + `logs:DescribeResourcePolicies`) — confirmado
con la misma fuente autoritativa que ya se usó para `DescribeLogGroups`
(dataset del Service Authorization Reference de AWS): ambas acciones
tienen `resource_types` vacío, igual que `DescribeLogGroups`, y por lo
tanto exigen `Resource: "*"` sin excepción, no acotable a un ARN
específico. Error real obtenido en vivo: `AccessDeniedException: You
don't have the permissions that are required to perform this operation`
al correr `terraform apply` sobre ese recurso puntual.

**Para retomar cuando se decida continuar:**
1. Agregar un statement nuevo (en `iam-provisioning-policy-datos.json`,
   mismo criterio que `CloudWatchLogsDescribeGruposSinAlcanceDeRecurso` —
   tiene margen de caracteres) con `"Action": ["logs:PutResourcePolicy",
   "logs:DescribeResourcePolicies"]` y `"Resource": "*"`.
2. Pegar el archivo completo actualizado en la consola AWS
   (`indi-provisioning-policy-datos`).
3. Correr `cd infra/terraform && terraform apply` — debe crear
   `aws_wafv2_web_acl_logging_configuration.adms` sin error (el log group
   destino, `aws-waf-logs-indi-asistencia-production-adms`, ya existe,
   creado y confirmado hoy).
4. Repetir la prueba real ya usada antes: `curl
   "https://api.sistemasindi.com/iclock/cdata?SN=TEST-SN-MB10VL-001&options=all"`
   (debe seguir dando `403`) y confirmar que el intento aparece en
   CloudWatch Logs, log group `aws-waf-logs-indi-asistencia-production-adms`
   (requiere además el permiso de lectura de logs ya agregado hoy,
   `CloudWatchLogsParaWAF`/`CloudWatchLogsDescribeGruposSinAlcanceDeRecurso`
   en `iam-provisioning-policy-datos.json`, ya confirmado funcionando).

**El drift-check de IAM (`infra/terraform/iam_drift_check.tf`, agregado
hoy) ya demostró su valor en esta misma sesión** — encontró un drift real
preexistente (`CloudWatchLogsParaBackend` con `Resource: "*"` en la
consola, no reflejaba un fix ya hecho en el archivo local) antes de que
nadie lo pidiera explícitamente, y superó tanto la prueba positiva (plan
limpio con ambas políticas sincronizadas) como la negativa (modificación
local temporal → `Error: Resource postcondition failed` con el mensaje
esperado, sin necesitar que un error de permisos a medias lo revelara
por accidente). Que el pendiente de arriba (logging del WAF) siga abierto
no le resta valor a esto — son dos cosas independientes.

**Reconciliación PIN → Trabajador:** `Trabajador.numeroChecador` (`Int?
@unique`, migración `20260725145731_agregar_soporte_adms_zkteco`) — el ID
numérico con el que la persona se enroló *en el equipo* (el enrolamiento
de huella/rostro ocurre ahí, no en este sistema). Nullable y sin backfill
del roster original a propósito (decisión confirmada con el usuario
2026-07-25): RH lo captura a mano vía `PATCH /trabajadores/:id` conforme
va enrolando gente en el MB10-VL, no se asume que el "no" del roster de
campo (`prisma/seed-data/roster_enrolamiento_tren_golfo.json`) vaya a
coincidir con el PIN real de este equipo nuevo. Si el PIN de una
marcación no coincide con ningún `numeroChecador` (typo al capturarlo,
alguien se enroló antes de que RH diera de alta el número, etc.), **no se
descarta en silencio ni se inventa un Trabajador**: se guarda en
`EventoNoReconciliado` (PIN crudo + fecha/hora + método crudo) para que
RH lo revise.

**Sección/turno fijos:** todo lo que venga de un `Terminal` tipo="adms" se
guarda con sección **"Oficina"** (sembrada en `seed.ts`, usa el mismo
`Horario` "Oficina" ya existente) y turno `"Oficina"` — mismo valor que el
nombre del Horario, replicando la convención que ya usa el Kiosco manual
(`turno` = nombre del Horario configurado). Confirmado con el usuario
2026-07-25 (antes de esto no existía ninguna Sección de oficina — las 4
originales son todas de campo). Asume un solo equipo ADMS de oficina; si
algún día hay más de uno, esto necesitaría diferenciarse por terminal, no
un valor fijo global.

**Pantalla de confirmación (Kiosco, `frontend/.../pages/KioscoPage.tsx`):**
tercer modo del Kiosco (además de login y config), seleccionable en
`ConfigForm` (`ConfigKiosco.modo: "marcacion" | "confirmacion"`). En modo
`"confirmacion"`, `PantallaConfirmacion` nunca marca nada — hace polling
cada 2.5s a `GET /asistencias/reciente` (Terminal-autenticado, cualquier
Terminal con JWT, no gateado por rol) y muestra la misma animación de
éxito que el modo manual (con el NOMBRE del trabajador, no su UUID) en
cuanto detecta un `id` de asistencia distinto al último visto, sin que
nadie toque nada. **Bug real encontrado probando con Electron real y ya
corregido:** el primer poll tras montar/reconfigurar no debe disparar la
animación aunque encuentre una asistencia (si no, la última marcación real
— aunque sea de ayer — se muestra como "recién ocurrida" apenas arranca la
pantalla); el primer poll solo establece la base de comparación.

`obtenerAsistenciaMasRecienteDeTerminal` (`asistencia.service.ts`) filtra
por `terminalOrigen.tipo = "adms"`, **no** por el `terminalId` de quien
pregunta — la pantalla de confirmación y el equipo ADMS físico son dos
`Terminal` distintos (el primero nunca marca nada, el segundo nunca tiene
sesión JWT), así que filtrar por el terminalId de quien hace polling
nunca habría encontrado nada. Correcto mientras haya un solo lector ADMS
de oficina (el caso real hoy); con más de uno necesitaría un vínculo
explícito pantalla↔lector en vez de "cualquier ADMS".

## Reference project

This backend intentionally mirrors the conventions of a sibling Grupo INDI
project, `Control_Grupo_INDIv2/backend` (referred to as "lo ya probado" —
the proven reference). When extending this codebase (new modules, new auth
flows, new serializers), match that project's patterns rather than
inventing new ones, unless the user says otherwise.

## Current state (see project memory for up-to-date detail)

Backend "core" is done: full schema + migrations + seed, JWT/bcrypt auth,
CRUD for every entity (trabajadores/secciones/horarios/tipos de
movimiento/tarifas de hora extra — the last one append-only —
movimientos/nóminas/usuarios/terminales), attendance kiosk endpoint
(`POST /asistencias`), the daily seccion assignment module
(`AsignacionDiaria` + `/asignaciones` + `GET /secciones/:id/hoy` real-time
presente/ausente view), read-only Terminal access to secciones/horarios,
and audit logging (`AuditLog`) covering every sensitive write across
usuarios/terminales/asignaciones/nóminas/trabajadores/horarios/secciones/tipos
de movimiento/tarifas de hora extra, plus financial report exports
(`GET /reportes/nomina/exportar`). Trabajador edits log only which field
*names* changed, never sueldo/banco/clabe values, so an `administrador`
(who can read `/auditoria` but not `/trabajadores`, rh-only) can't recover
payroll data through the audit trail.

Frontend has all 9 planned screens built and working end-to-end against
the real API: Login, Kiosco, Dashboard, Trabajadores, Asistencias,
Encargado de sección, Nómina RH, Usuarios y accesos, Configuración,
Reportes — plus `electron-builder` Windows (NSIS) packaging. Not yet done:
ZKTeco Horus E1-FP (or alternative) hardware integration — see
"Bloqueado" below.

As of 2026-07-23 a full closing-pass regression (all 9 screens, each
relevant role) found 0 bugs, and a repo-wide TODO/FIXME/"temporal" sweep
found nothing unresolved. `TarifaHoraExtra` has a loaded value ($90.00/hora
desde 2026-01-01) but it's leftover test data from an earlier session —
**not yet confirmed by the client as the real rate**; don't treat it as
authoritative for actual payroll without that confirmation.

As of 2026-07-25 the authentication screens got a security/UX pass:
password policy (min 8 chars + letter + number) enforced on the 3 places a
password gets set, per-account lockout after 5 failed logins (independent
of the IP/identity rate limiter), split JWT expiry for human vs. Terminal
sessions, a 30-minute client-side inactivity timeout, show/hide-password +
real-time requirements checklist on every password field, and an
Ayuda/Soporte modal (placeholder contact info) reachable from every role's
sidebar. All of it tested against real Electron + the real Supabase
database (weak-password rejection, the actual 5-fail lockout, the
inactivity timeout with a temporarily-shortened threshold, reset-on-activity)
— see the Auth and Frontend sections above for the technical detail.

Also as of 2026-07-25: ADMS support for the ZKTeco MB10-VL office reader
(`src/services/adms.service.ts`, `src/routes/adms.routes.ts` — see the
"ADMS" section above for the full technical detail), plus a third Kiosco
mode (`PantallaConfirmacion`) that displays those marcaciones live. Tested
end-to-end with simulated ADMS requests (`curl`, imitating the real
protocol format) and with real Electron (confirmed the confirmation
screen reacts automatically to an external push without anyone touching
the app) — **not yet tested against the physical MB10-VL**, which isn't
connected yet (see "Bloqueado").

## Bloqueado — fuera del alcance de este repositorio

Estos puntos no se resuelven con código en este repo; requieren una
decisión, ejecución o insumo externo del usuario/cliente:

- **Integración de hardware biométrico real** — pendiente decisión final
  entre S922+hotspot 4G vs. lector Horus E1-FP.
- **Verificación de safeStorage en Windows real** — ver
  `frontend/QA_SAFESTORAGE_WINDOWS.md`; requiere que el usuario lo corra
  en una máquina Windows real (Wine no cuenta). No cerrar este punto
  hasta que el usuario marque esa lista.
- **Lector ADMS de oficina (ZKTeco MB10-VL) — protocolo implementado y
  probado con datos simulados, pendiente de verificación contra el equipo
  físico real.** Ver sección "ADMS" arriba para el detalle técnico
  completo. Pendientes concretos para cuando el equipo esté conectado:
  confirmar el número de serie real (hoy solo hay uno de prueba,
  `TEST-SN-MB10VL-001`, que no debe quedar en ninguna base real), validar
  que el mapeo de método de verificación (`1=huella, 15=rostro`) coincide
  con lo que este modelo/firmware realmente manda, confirmar la IP
  pública real de la oficina para `ADMS_IPS_PERMITIDAS` (hoy solo hay un
  valor de ejemplo en `.env.example`/`terraform.tfvars.example` — sin
  eso, en producción el endpoint rechaza todo por diseño, fail-closed), y
  **probar contra el menú real del equipo si el campo `Server Address`
  (en `Cloud Server Setting`) acepta un valor con forma de path** (ej.
  `midominio.com/token-secreto`) — idea de respaldo identificada al
  descartar el Comm Key (ver sección ADMS) pero sin forma de verificar sin
  el equipo físico en mano.
- **Cumplimiento legal / ubicación de almacenamiento de datos
  biométricos** — pendiente de asesoría legal externa.
- **Datos operativos reales de RH** — horario real de campo, nombres de
  encargados de sección, y confirmación de si existen más obras además
  de Tren Golfo de México.
- **Despliegue real del backend a producción** — sigue corriendo solo en
  local; no hay ambiente de producción todavía. Preparado pero no
  conectado en dos rutas paralelas (ninguna aplicada/desplegada aún):
  Railway (`PORT`/`/health` listos, `.env.example` documentado) y AWS App
  Runner + RDS vía Terraform (`infra/terraform/`, ver
  `infra/AWS_MIGRATION.md` para la checklist completa) — falta decidir
  cuál de las dos se usa de verdad, crear la cuenta correspondiente, y
  para AWS específicamente falta además probar en vivo el CA pinning de
  RDS (código listo, no verificado contra una instancia real todavía).
- **`db_backup_retention_days` de RDS debe subirse antes de que la
  instancia tenga datos reales de producción — hoy vale `1` día, no por
  elección, sino porque `7` (el valor original) falló en vivo contra la
  cuenta real con `FreeTierRestrictionError` (ver comentario en
  `infra/terraform/variables.tf`, la cuenta de AWS es nueva y está bajo
  restricciones de Free Tier en varios recursos a la vez — mismo patrón
  que el tipo de instancia EC2 del bastión).** 1 día de retención es
  insuficiente para nómina/datos biométricos reales — no hay margen para
  recuperar un backup si el problema se detecta unos días después. AWS no
  documenta el límite exacto permitido bajo Free Tier. **Reintentado en
  vivo 2026-07-31** (`terraform apply -target=aws_db_instance.postgres`),
  después de varias sesiones usando RDS/ECS/ALB/WAF/Route53/ACM en la
  misma cuenta — probado con 7, 4 y 2: **los tres fallan con el mismo
  `FreeTierRestrictionError`, idéntico al del primer intento.** El límite
  real de la cuenta hoy sigue siendo exactamente 1, sin cambio — usar
  otros servicios de AWS no afecta esta restricción específica de RDS.
  Confirmado además contra el estado real de la instancia
  (`aws rds describe-db-instances`, `BackupRetentionPeriod: 1`), no solo
  contra el state de Terraform. La única salida que AWS documenta en el
  mensaje de error es upgradear el plan de la cuenta (salir de Free Tier
  por completo) — no hay un número intermedio que aceptar mientras la
  cuenta siga en ese estado. Sigue siendo insuficiente para nómina/datos
  biométricos reales; revisar de nuevo si la cuenta cambia de plan, o
  aceptar el riesgo documentándolo explícitamente si se decide migrar
  datos reales de todos modos sin resolver esto primero.

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
npm run build             # tsc -> dist/
npm start                 # run compiled dist/index.js
npm run prisma:generate   # regenerate Prisma client after schema changes
npm run prisma:migrate    # prisma migrate dev (creates + applies a migration)
npm run prisma:studio     # Prisma Studio GUI
npm run seed               # ts-node prisma/seed.ts
```

There is no test suite or lint config yet. `tsc` (via `npm run build`) is the
only current form of static verification.

### Environment

Copy `backend/.env.example` to `backend/.env`. Required at boot (validated in
`src/config/env.ts`, process exits with a clear message if missing):
`DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGIN`. `ADMIN_SEED_USERNAME` /
`ADMIN_SEED_PASSWORD` are required only by `prisma/seed.ts` (first-run admin
account; the seed never overwrites an existing user's password).

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
- `express-rate-limit`: a global limiter (100 req/15min, `app.ts`) plus a
  stricter one (5 req/15min) applied only to `/auth/login`.

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
(weekly payroll), `Terminal` (biometric kiosks), `AuditLog`.

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
seeds the Obra/Secciones, a placeholder office `Horario`, the
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
presente/ausente view), and read-only Terminal access to
secciones/horarios. Payroll calculation logic works but `TarifaHoraExtra`
is deliberately unseeded (no confirmed real value yet).

Frontend has Login + Kiosco built and working end-to-end against the real
API (see the Frontend section above). Not yet built: Dashboard,
Asistencias/Residentes, Encargado de sección, Nómina RH, Usuarios y
accesos, Configuración/Reportes screens — in that order — plus
`electron-builder` packaging and ZKTeco Horus E1-FP hardware integration.

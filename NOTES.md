# Notas sobre el historial de git

Los commits 1-11 son una reconstrucción histórica hecha el 2026-07-22, con
fines de autoría/fecha real (el trabajo se hizo entre 2026-07-20 y
2026-07-21 pero no se fue comiteando sobre la marcha). Las fechas de cada
commit vienen de evidencia real: mtime de los archivos, los timestamps UTC
embebidos en los nombres de las carpetas de migración de Prisma, y las
fechas registradas en la documentación de sesiones de trabajo.

**No todos los commits 1-11 compilan de forma aislada.** Al agrupar los
archivos por su último mtime real, ciertos archivos "pegamento" —
`routes/index.ts`, `auth.service.ts`, `asignacion.service.ts`,
`asistencia.service/controller/routes`, `trabajador.service/controller/routes`,
`seccion.service.ts` en el backend; `App.tsx`, `api/auth.ts`,
`api/trabajadores.ts`, `api/asignaciones.ts`, `secureStore.ts` en el
frontend — quedaron agrupados en los últimos commits de cada paquete
(porque su última edición real ocurrió en esa sesión), aunque archivos de
commits anteriores ya los importaban. Eso produce errores de
`tsc --noEmit` tipo "Cannot find module" en los commits intermedios —
confirmado corriendo el typecheck vía checkout aislado de cada commit.

**Solo el commit 12 (backend, `Backend: Encargado de sección...`) y el
commit 13 (frontend, `Frontend: Kiosco...`) representan snapshots
completos y compilables de cada paquete respectivamente.** Los commits
1-11 son puntos de referencia históricos/de autoría, no puntos de bisect
verdes.

**A partir de este commit (14 en adelante), cada commit se hace en tiempo
real y debe compilar de forma aislada** (`npx tsc --noEmit` en el paquete
correspondiente) antes de crearse.

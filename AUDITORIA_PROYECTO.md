# Auditoría final de entrega — INDI Asistencia

**Base auditada:** `v0.9.0-rc.2`

**Commit:** `248f1493cb16a8bfec70363f2e8303b373b8f379`

**Fecha de corte:** 13 de agosto de 2026

**Alcance:** software, pruebas, instalador, documentación e infraestructura
declarada. No se realizaron cambios en producción ni pruebas con hardware
biométrico físico durante esta auditoría.

## 1. Resumen ejecutivo

La RC2 contiene un sistema funcional de asistencia y nómina con cliente
Electron, API Express y PostgreSQL. Incluye autenticación y roles, asistencia
por Kiosco/ADMS, trabajadores, catálogos, nómina, movimientos, horas extra,
sueldo masivo, reportes, exportaciones, auditoría, administración de
Terminales y congelamiento de escrituras para cortes controlados.

La evidencia disponible permite presentar el software como **listo para
entrega de residencia profesional**. No equivale a declarar operación de
campo completa: hardware ZKTeco físico, validación ADMS real, datos y reglas
finales de RH/legal, y el corte productivo a AWS México siguen pendientes por
insumos o autorizaciones externas.

## 2. Identidad y reproducibilidad de RC2

- Tag anotado local: `v0.9.0-rc.2`.
- RC1 permanece en su commit original y no fue movida.
- Instalador: `frontend/dist/INDI Asistencia Setup 0.9.0-rc.2.exe`.
- Tamaño: `105,788,574 bytes`.
- SHA-256:
  `ccea844a993506ecbac724e88752634f75af2fda1644b397de8c6d37fa3afe7d`.
- NSIS x64: `oneClick=false`, `perMachine=false`,
  `deleteAppDataOnUninstall=true`.
- Electron `43.1.1`; electron-builder `26.15.3`.

`.obsidian/` es metadata local ajena a la aplicación y no forma parte de RC2.

## 3. Sistema entregado

### Funcionalidad

- Login humano con bcrypt/JWT, bloqueo de cuenta, cambio obligatorio de
  contraseña y timeout de inactividad.
- Roles `trabajador`, `recepcion`, `encargado_seccion`, `rh` y
  `administrador`, aplicados en backend y navegación.
- Trabajadores, categorías, obras, frentes/secciones y horarios.
- Asistencia, asignación diaria y corrección manual exclusiva de RH.
- Kiosco/Terminal con JWT propio y confirmación de marcaciones.
- ADMS `/iclock/*`: handshake, ATTLOG, reconciliación por PIN, duplicados y
  eventos no reconciliados.
- Movimientos, tarifa de hora extra, nómina semanal y snapshots históricos.
- Aplicación masiva de sueldo a trabajadores activos seleccionados, atómica y
  sin alterar `NominaSemanal` histórica.
- Reportes de asistencia/nómina y exportaciones XLSX/PDF con neutralización de
  fórmulas.
- AuditLog para escrituras sensibles sin guardar montos financieros en el
  detalle de cambios de trabajador.
- Alta/edición/activar-desactivar Terminales.
- `MAINTENANCE_MODE` para congelamiento central de escrituras.

### Plataforma

- Frontend: Electron, React 19, TypeScript, electron-vite, HashRouter.
- Backend: Node.js, Express 5, TypeScript, Prisma 6.
- Datos: PostgreSQL y 12 migraciones Prisma.
- Infraestructura declarada: ECS/Fargate, ALB, RDS, WAF, Route 53, ACM,
  Secrets Manager y endpoints privados.
- Distribución Windows: instalador NSIS x64.

### Seguridad implementada

- JWT humano y Terminal estructuralmente distintos y no intercambiables.
- Sesiones humana/Terminal persistidas con safeStorage; DPAPI validado en
  Windows. JWT Terminal ausente de Local/Session Storage.
- CSP restrictiva, fuentes locales, `contextIsolation=true`, `sandbox=true`,
  `nodeIntegration=false`, permisos/navegación/ventanas externas bloqueados.
- `deleteAppDataOnUninstall=true`; reinstalación comienza limpia.
- Helmet, CORS, límite JSON, validaciones, serializers allow-list, roles y rate
  limiting.
- Usuario activo verificado durante autenticación/autorización.
- ADMS protegido por allowlist de aplicación limitada a `/iclock/*`,
  fail-closed en producción, más WAF documentado.
- Guard global de mantenimiento antes de auth/controllers/Prisma.

## 4. Matriz de estado

| Componente | Estado | Evidencia | Limitación/impacto |
| --- | --- | --- | --- |
| Login humano | LISTO | Unitarias, HTTP, integración y E2E | JWT stateless sin revocación anticipada |
| Roles/navegación | LISTO | Tests de menú, integración HTTP, E2E y smoke Windows | Matriz deliberadamente restrictiva |
| Trabajadores/categorías/frentes | LISTO | UI/API, integración y E2E | “Frente” UI; `Seccion` técnico |
| Asistencia/correcciones | LISTO | Unitarias + PostgreSQL/HTTP real | Corrección manual solo RH |
| Sueldo masivo | LISTO | Integración PostgreSQL, E2E y QA Windows | Solo activos; transacción completa |
| Nómina/movimientos/horas extra | LISTO CON LIMITACIÓN | Unitarias, integración y exports | Valores operativos deben confirmarse con RH |
| Reportes XLSX/PDF | LISTO | Unitarias e integración real | Validar contenido con datos autorizados al operar |
| AuditLog | LISTO | Integración y congelamiento | No reemplaza política externa de retención |
| Terminal/Kiosco | LISTO CON LIMITACIÓN | Unitarias, E2E y QA Windows | Sin hardware biométrico de campo validado |
| ADMS software | LISTO CON LIMITACIÓN | Unitarias, HTTP, integración | Protocolo reconstruido; falta dispositivo real |
| ADMS con ZKTeco físico | PENDIENTE EXTERNO | Checklist preparada | Hardware no disponible/verificado |
| Electron hardening | LISTO | Tests CSP/sesiones/E2E | `style-src 'unsafe-inline'` aceptado temporalmente |
| Windows/NSIS | LISTO | QA Windows real RC2 | Instalador sin code signing |
| safeStorage/DPAPI | LISTO | QA Windows humano y Terminal | Falla forzada de DPAPI no ejecutada (opcional) |
| Web Storage | LISTO | Playwright nativo Windows | Solo configuración no sensible permanece local |
| Uninstall/reinstall | LISTO | NSIS real; `userData` ausente | El uninstall elimina configuración propia |
| Tests y lint | LISTO CON LIMITACIÓN | 83 pruebas; CI | 15 warnings frontend conocidos |
| CI | LISTO CON LIMITACIÓN | Workflow backend/frontend | E2E Electron no corre en CI |
| PostgreSQL | LISTO | Migraciones + integración PostgreSQL 16 | Preflight debe confirmar versión/collation RDS real |
| Rehearsal AWS México | LISTO | Dos ciclos source→dump→restore→verify | Tiempos locales no predicen downtime real |
| Migración AWS México real | PENDIENTE EXTERNO | Runbook preparado | Requiere autorización, datos, DNS y observación |
| Modo mantenimiento | LISTO PARA CORTE | HTTP, integración DB, frontend, Windows | Requests ya en vuelo deben drenarse |
| Hardware biométrico | PENDIENTE EXTERNO | Arquitectura y checklist | Equipo/proveedor no disponibles |
| Finiquitos | NO IMPLEMENTADO | Exclusión explícita | Faltan reglas RH/legal autorizadas |
| Definiciones RH/legal | PENDIENTE EXTERNO | Pendientes documentados | No deben inventarse en código |

## 5. Evidencia de calidad

Conteos reconstruidos desde las suites de RC2:

- Backend Vitest unitario/HTTP simulado: **41/41**.
- Backend integración PostgreSQL/HTTP real: **9/9**.
- Frontend Vitest/Testing Library: **23/23**.
- Electron Playwright E2E: **9/9**.
- Guardas anti-producción de migración: **1/1**.
- Total sin duplicar suites: **83 pruebas**.

Gates registrados para RC2:

- Backend build, `typecheck:prisma` y lint: PASS; lint 0 errores/0 warnings.
- Frontend typecheck y build: PASS.
- Frontend lint: 0 errores, 15 warnings conocidos.
- E2E Electron local/pre-release: 9 PASS.
- Integración: PostgreSQL 16 efímero, sin servicios externos.
- Rehearsal de migración: dos ejecuciones completas PASS, 137 trabajadores
  ficticios, 17 tablas con checksums, 33 constraints, 45 índices, 17 etiquetas
  enum y todos los conteos/checksums iguales.

Warnings frontend actuales:

- 14 `react-hooks/set-state-in-effect` en Asistencias, Configuración,
  Dashboard, Encargado, Kiosco, Nómina, Reportes, Terminales,
  TrabajadorForm, Trabajadores y Usuarios.
- 1 `no-irregular-whitespace` en `NominaPage.tsx`.

No bloquean RC2: son warnings, no errores; no aumentaron en el gate. Deben
tratarse como deuda técnica incremental, no silenciarse globalmente.

## 6. CI

`.github/workflows/ci.yml` corre en pull requests y push a `main`, con permisos
de contenido de solo lectura y Node 22.

- Job backend: PostgreSQL `16-alpine`, `npm ci`, Prisma generate, build,
  typecheck Prisma, tests, integración y lint.
- Job frontend: `npm ci`, typecheck, build, tests y lint.
- No ejecuta deploy, Terraform ni usa credenciales AWS/producción.
- E2E Electron no forma parte de CI; se ejecuta localmente/pre-release con
  backend y PostgreSQL efímeros por requerir runtime gráfico/orquestación.

## 7. Dependencias y riesgos de seguridad

`npm audit --omit=dev` al 13 de agosto de 2026:

- Frontend: **0 vulnerabilidades**.
- Backend: **2 moderadas, 0 altas, 0 críticas**. Son el paquete directo
  `exceljs@4.4.0` y su dependencia `uuid@8.3.2`, ambos referidos al mismo aviso
  `GHSA-w5hq-g745-h8pq` (bounds check en UUID v3/v5/v6 con buffer).

Las exportaciones no invocan esas variantes; npm solo propone bajar ExcelJS a
3.4.0, cambio regresivo. Se mantiene documentado y no se aplicó
`npm audit fix --force` ni override entre mayores. Revisar cuando ExcelJS
publique una cadena compatible.

Riesgos conocidos no bloqueantes para entrega académica:

- JWT stateless: logout elimina token local, no lo revoca server-side.
- Respuesta 423 de bloqueo puede confirmar existencia de una cuenta tras
  múltiples intentos.
- CSP conserva `style-src 'unsafe-inline'` por compatibilidad actual.
- 15 warnings React/estilo pendientes.
- Instalador RC sin firma de código.
- Contacto de Ayuda/soporte todavía es placeholder.

## 8. Datos biométricos

El schema no contiene plantilla biométrica, imagen de huella ni rostro. El
enrolamiento y la plantilla permanecen en el equipo. El backend almacena:

- banderas `huellaRegistrada`/`rostroRegistrado`;
- `numeroChecador` para reconciliar el PIN;
- método usado y evento de asistencia;
- PIN/método crudos en `EventoNoReconciliado` cuando no hay trabajador.

Esta separación reduce exposición técnica, pero no sustituye asesoría legal ni
políticas autorizadas sobre datos biométricos y laborales.

## 9. Hardware: pendiente externo

**PENDIENTE EXTERNO — HARDWARE NO DISPONIBLE.** No es un bug del software.
Cuando exista equipo físico, validar:

1. conexión de red y endpoint configurado;
2. número de serie real y alta de Terminal;
3. enrollment y correspondencia PIN/trabajador;
4. marcación por huella y rostro si el modelo lo soporta;
5. formato/mapeo ATTLOG real;
6. reintentos/backlog después de reconexión;
7. desconexión e indicador de inactividad;
8. duplicados exactos y entrada/salida legítimas;
9. allowlist de aplicación/WAF con IP autorizada;
10. recovery sin pérdida ni invención de trabajadores.

## 10. AWS México

### Infraestructura preparada/documentada

Terraform describe ECS/Fargate, ALB, RDS, WAF, Route 53, ACM, Secrets Manager,
endpoints y drift-check IAM. La documentación registra producción en
`us-east-1` y stack paralelo `-mx` en `mx-central-1`.

### Rehearsal local demostrado

Dos PostgreSQL 16 efímeros, datos ficticios, guardas anti-producción, custom
dump sin owner/ACL, restore con error fatal, conteos, checksums, schema,
constraints, consulta Prisma, congelamiento y backend smoke.

### Migración productiva no ejecutada

Requiere autorización y preflight real; congelar todas las tasks, drenar
requests, backup final, restore, integridad, backend/ALB/ECS/WAF, corte DNS,
observación y retiro posterior separado. No declarar “migrado a México” antes
de completar esas fases.

## 11. Modo mantenimiento

- `MAINTENANCE_MODE` ausente/`false`/`0`: normal.
- `true`/`1`: solo `/health` y OPTIONS; el resto 503 con código estable.
- Otro valor: arranque rechazado.
- Bloquea antes de rate limit, auth, routers, controllers y Prisma.
- Login, asistencia, ADMS, sueldo masivo y demás flujos no escriben.
- Integración PostgreSQL confirmó DB/AuditLog idénticos antes/después.
- Frontend/Kiosco muestran estado global y no simulan éxito.
- QA Windows RC2 confirmó pantalla y recuperación al modo normal.

Está **LISTO PARA SER UTILIZADO DURANTE EL CORTE**, no activado en AWS real.
Todas las tasks ECS deben compartir configuración. Tras activar, esperar
deployment estable y drenar requests/transacciones que ya estaban en vuelo
antes del dump.

## 12. QA Windows RC2

Evidencia real en Windows 11/VirtualBox:

- instalación NSIS, login, logo, fuentes y tema;
- CSP/HashRouter/Chart.js y backend test;
- DPAPI/safeStorage humano y Terminal;
- Recordarme, cierre/reapertura, reinicio real y logout;
- JWT Terminal ausente de Web Storage por inspección nativa;
- sueldo masivo y smoke de roles con datos ficticios;
- pantalla de mantenimiento y recuperación normal;
- uninstall NSIS RC2 y `userData`/procesos ausentes.

Detalle: [`frontend/QA_SAFESTORAGE_WINDOWS.md`](frontend/QA_SAFESTORAGE_WINDOWS.md).

## 13. Trabajo desarrollado durante la residencia

- **Análisis:** procesos de asistencia/nómina, roles, flujos biométricos,
  riesgos, reglas cerradas y dependencias externas.
- **Diseño:** arquitectura por capas, modelo relacional, matriz de permisos,
  separación Kiosco/ADMS y snapshots de nómina.
- **Backend:** API, auth, CRUD, asistencia, nómina, reportes, auditoría, ADMS y
  mantenimiento.
- **Frontend:** cliente Electron/React, paneles por rol, Kiosco, reportes,
  sueldo masivo y UX de mantenimiento.
- **Biometría:** integración software ADMS, reconciliación y deduplicación sin
  almacenar plantillas biométricas.
- **Seguridad:** hardening Electron, safeStorage/DPAPI, CSP, roles, validación,
  allowlist ADMS y uninstall seguro.
- **Base de datos:** schema Prisma, migraciones, constraints y pruebas con
  PostgreSQL real aislado.
- **Infraestructura:** Terraform AWS, runbook México y rehearsal local.
- **Testing:** unitarias, integración HTTP/PostgreSQL, E2E Electron, QA Windows
  y guardas anti-producción.
- **Documentación:** README, guías técnicas, runbook, manuales, arquitectura y
  checklist de entrega.

## 14. Entregables académicos localizados

| Entregable posible | Estado | Ubicación/acción |
| --- | --- | --- |
| Código fuente | Ya existe | `backend/`, `frontend/`, `infra/` |
| README | Ya existe | `README.md` |
| Manual de instalación | Ya existe | `docs/MANUAL_INSTALACION.md` |
| Manual de usuario | Ya existe | `docs/MANUAL_USUARIO.md` |
| Arquitectura/diagramas | Ya existe | `docs/ARQUITECTURA.md` + README |
| Evidencia de pruebas | Ya existe | tests, CI, QA Windows, esta auditoría |
| Instalador RC | Ya existe | `frontend/dist/` local + hash |
| Informe técnico académico | Parcial | Fuentes técnicas; falta adaptar a plantilla institucional |
| Reportes semanales | Parcial | Historial Git/NOTES; formato institucional no localizado |
| Presentación final | No localizada | Preparar si la institución la solicita |
| Formatos administrativos | No localizados | Confirmar con institución |

Consultar [`docs/CHECKLIST_ENTREGA.md`](docs/CHECKLIST_ENTREGA.md).

## 15. Estimación de avance

### Residencia profesional: aproximadamente 95 %

El software, seguridad, pruebas, instalador y documentación técnica están
terminados. El porcentaje restante corresponde principalmente a consolidar el
informe/presentación y formatos institucionales, no a construir módulos
funcionales centrales.

### Operación productiva completa: aproximadamente 75 %

La base de software es sólida, pero faltan hardware/QA ADMS físico, decisiones
RH/legal, datos operativos definitivos, firma/canal estable, retención de
backup y migración/corte real México. La diferencia no debe interpretarse como
25 % de código faltante: predominan ejecución y dependencias externas.

Estas cifras son estimaciones por áreas ponderadas, no métricas contractuales.

## 16. Pendientes clasificados

### Bloqueantes para residencia

- Confirmar la rúbrica institucional y entregar informe/presentación/formato
  administrativo si son obligatorios. No se identificó un bloqueo técnico del
  sistema para la exposición académica.

### No bloqueantes para residencia

- 15 warnings frontend.
- Auditoría manual adicional tipo pentest/Burp si se desea como anexo.
- Firma digital del instalador.
- Sustituir contacto placeholder de soporte.

### Bloqueantes para producción completa

- Hardware físico y QA ADMS real.
- Datos/valores operativos confirmados por RH.
- Decisión legal sobre tratamiento/retención aplicable.
- Migración productiva México y observación.
- Política suficiente de backups/retención.
- Canal de distribución y soporte operativo aprobados.

### Externos

- Disponibilidad/selección del equipo y respuesta del proveedor.
- Horarios, encargados, categorías/sueldos, tarifa y otras definiciones RH.
- Reglas de finiquitos y autorización legal.
- Ventana/autorización para AWS México y DNS.

## 17. Plan posterior a RC2

1. Consolidar entrega académica con la plantilla oficial.
2. Obtener/configurar hardware.
3. Ejecutar QA ADMS físico y documentar evidencia.
4. Completar preflight AWS México y autorizaciones.
5. Ejecutar migración productiva según runbook.
6. Observar México sin destruir inmediatamente el origen.
7. Resolver riesgos aceptados y preparar una release estable; no crearla por
   inferencia a partir de esta auditoría.

## 18. Veredictos

- **Académico:** PROYECTO LISTO PARA ENTREGA DE RESIDENCIA.
- **Productivo:** PENDIENTE PARA PRODUCCIÓN.

El segundo veredicto no contradice el primero: los faltantes productivos son
principalmente hardware, operación, datos/autorizaciones y migración real.

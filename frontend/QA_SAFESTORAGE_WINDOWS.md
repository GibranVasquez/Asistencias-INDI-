# QA de `safeStorage` y empaquetado en Windows

Última ejecución: 12 de agosto de 2026.

Entorno usado: Windows 11 Enterprise LTSC Evaluation 64-bit (build 26100),
VM VirtualBox 7.2, x64, usuario ficticio `vboxuser`, backend local de test y
PostgreSQL 16 efímero. No se usaron servicios, credenciales ni datos de
producción.

Build evaluado: Electron 43.1.1, NSIS x64, aplicación instalada en
`C:\Program Files\INDI Asistencia`. El instalador no tiene firma de código;
Windows muestra por ello editor desconocido/UAC. No se desactivaron UAC,
SmartScreen ni Defender.

Instalador final evaluado: `INDI Asistencia Setup 0.1.0.exe`, 105,788,332
bytes, SHA-256
`26f5de504279d065b33ea613770dd4b3a5cb032ca4301e2f8aabf18cba488b03`.

## Resultado de la ejecución

| Caso | Estado | Evidencia breve |
| --- | --- | --- |
| Instalación NSIS y acceso directo | PASS | Instalación interactiva completada y app abierta desde el acceso directo, no desde `npm run dev`. |
| Smoke visual empaquetado | PASS | Logo, animación inicial, login, tema claro/oscuro y fuentes locales renderizaron sin pantalla azul. |
| CSP/React/HashRouter/Chart.js | PASS | Login real y Dashboard RH con gráfica renderizados en el build empaquetado; la API se limitó al origen local exacto de test. No se abrió DevTools de producción. |
| `safeStorage.isEncryptionAvailable()` humano | PASS | Guardar y descifrar `sesion.enc` funcionó en Windows; si la API hubiese reportado `false`, el handler habría rechazado y mostrado sesión degradada. |
| Login sin Recordarme | PASS | Entró al Dashboard; tras cerrar completamente Electron volvió a Login. |
| Login con Recordarme | PASS | Tras cerrar/reabrir Electron restauró el Dashboard sin volver a ingresar credenciales. |
| Persistencia tras reinicio real de Windows | PASS | Se ejecutó `shutdown /r /t 0`; al abrir la app después del arranque se restauró la sesión humana. |
| Logout humano | PASS | Logout regresó a Login; cerrar/reabrir no restauró la sesión. |
| Terminal: activar y persistir | PASS | Terminal ficticia activada contra backend test; al cerrar/reabrir omitió activación y restauró la sesión segura. |
| Terminal: desvincular | PASS | “Cerrar sesión del terminal” regresó a Activar Terminal; al reabrir permaneció desvinculada. |
| Web Storage Windows / JWT Terminal | PASS | Playwright se ejecutó nativamente dentro de Windows usando el runtime Node del Electron empaquetado. En instalación limpia y con Terminal activa, `indi_terminal_sesion` y nombres de clave con `jwt`/`token` estuvieron ausentes en Local Storage y Session Storage. Solo se imprimieron booleanos; ningún valor o token. `terminal-sesion.enc` existió durante la sesión, la Terminal siguió funcional y el archivo desapareció tras desvincular. |
| Storage Windows / metadatos de sesión | PASS | Tras el uninstall nuevo y antes de reinstalar, `C:\Users\vboxuser\AppData\Roaming\indi-asistencia-frontend` no existía. Por tanto estaban ausentes `sesion.enc`, `terminal-sesion.enc`, Local Storage, Session Storage, Cookies y el resto del perfil propio. |
| Administrador en Windows | PASS | Login ficticio abrió Dashboard; el menú empaquetado mostró Dashboard, Usuarios, Terminales y Ayuda, sin Nómina ni otras rutas financieras. |
| Recepción en Windows | PASS | Login ficticio abrió Control de asistencias; el menú mostró únicamente Asistencias y Ayuda, sin rutas financieras. |
| Encargado en Windows | PASS | Login ficticio abrió `Mi frente · hoy` / `Frente ficticio E2E`; el menú mostró únicamente Encargado y Ayuda, sin Nómina. |
| Sueldo masivo en Windows, build final | PASS | RH seleccionó exactamente Ana y Bruno ficticios; contador 2, monto `$1,234.56`, foco inicial en `Aplicar a 2` y ciclo Tab Confirmar/Cancelar verificados. La UI confirmó éxito, limpió selección y sueldo. PostgreSQL mostró Ana/Bruno en 1234.56, Control sin cambio en 800.00, nómina histórica intacta en 500.00/500.00 y 2 auditorías distintas sin el monto. |
| Desinstalación NSIS | PASS | Con `deleteAppDataOnUninstall: true`, el asistente nuevo llegó a “INDI Asistencia ha sido desinstalado de su sistema”; se completó cada pantalla y desapareció la instalación. |
| Estado de `userData` tras desinstalar | VERIFICADO — ELIMINADO | Antes de reinstalar se comprobó por presencia, sin leer contenido, que `C:\Users\vboxuser\AppData\Roaming\indi-asistencia-frontend` no existía. |
| Reinstalación limpia tras desinstalar | PASS | Tras reiniciar Windows y reinstalar exactamente el mismo SHA-256, el primer inicio mostró Login. Sesión humana restaurada: no. Sesión Terminal restaurada: no. |
| Falla forzada de DPAPI | NO EJECUTADO | Caso opcional; no se debilitó ni manipuló el perfil Windows para provocarlo. |

## Bugs encontrados durante QA

1. Una sesión deliberadamente efímera mostraba el banner de fallo de
   `safeStorage`. La causa era que `sesionPersistida=false` mezclaba “no se
   solicitó Recordarme” con “Recordarme falló”. Se separó el estado de
   degradación y se añadieron pruebas para los tres casos.
2. `ModalConfirmacion` no movía ni retenía el foco. Con teclado era posible
   activar controles detrás del overlay (en Trabajadores se limpió la
   selección y el modal pasó a “Aplicar a 0”). Se añadió semántica de
   diálogo modal, foco inicial en Confirmar, Escape y ciclo de Tab, más una
   regresión que confirma por teclado.
3. El NSIS anterior conservaba `userData` y una reinstalación restauraba automáticamente
   la sesión humana cifrada que estaba en `sesion.enc`. En esta prueba la UI
   abrió la ruta privada del encargado sin pedir login; el backend de test
   estaba detenido, por lo que la API mostró “No se pudo conectar con el
   servidor” y no se verificó si el JWT seguía vigente. Es un riesgo de
   privacidad en equipos transferidos o reinstalados. No se cambió el
   desinstalador: borrar `userData`/invalidar sesiones requiere una decisión
   explícita de producto y seguridad. La política fue aprobada y el instalador
   ahora usa `deleteAppDataOnUninstall: true`; el nuevo QA confirmó eliminación
   del perfil y reinstalación sin sesión residual.

Ambos fixes requieren que cualquier repetición manual use un instalador
generado después de esos cambios; no debe validarse con un `.exe` anterior.

## Cierre de QA Windows

La última comprobación pendiente se ejecutó nativamente en Windows. Los ocho
indicadores de claves heredadas y nombres `jwt`/`token` fueron `false`, tanto
antes como después de activar una Terminal ficticia. La sesión permaneció
funcional mediante `safeStorage`, sin imprimir datos sensibles.

El estado global es **QA WINDOWS LISTO**.

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

Instalador final evaluado: `INDI Asistencia Setup 0.1.0.exe`, 105,788,476
bytes, SHA-256
`8c932cad260b45205198aff81581e7e05dde0aeff9d6c4f16533bb3ca6ce3ab3`.

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
| JWT ausente de localStorage/sessionStorage en disco Windows | NO EJECUTADO | Se intentó una inspección que solo devolvía cuatro booleanos, pero PowerShell no generó el archivo de resultados. No se leyeron ni imprimieron valores, JWT, cookies o contenido descifrado; no se infiere PASS del código/E2E. |
| Storage Windows / metadatos de sesión | PASS | Inspección posdesinstalación sin leer contenido: `sesion.enc` presente (642 bytes), `terminal-sesion.enc` ausente (0 bytes), Local Storage, Session Storage, Preferences y Cookies presentes; IndexedDB ausente. |
| Administrador en Windows | PASS | Login ficticio abrió Dashboard; el menú empaquetado mostró Dashboard, Usuarios, Terminales y Ayuda, sin Nómina ni otras rutas financieras. |
| Recepción en Windows | PASS | Login ficticio abrió Control de asistencias; el menú mostró únicamente Asistencias y Ayuda, sin rutas financieras. |
| Encargado en Windows | PASS | Login ficticio abrió `Mi frente · hoy` / `Frente ficticio E2E`; el menú mostró únicamente Encargado y Ayuda, sin Nómina. |
| Sueldo masivo en Windows, build final | PASS | RH seleccionó exactamente Ana y Bruno ficticios; contador 2, monto `$1,234.56`, foco inicial en `Aplicar a 2` y ciclo Tab Confirmar/Cancelar verificados. La UI confirmó éxito, limpió selección y sueldo. PostgreSQL mostró Ana/Bruno en 1234.56, Control sin cambio en 800.00, nómina histórica intacta en 500.00/500.00 y 2 auditorías distintas sin el monto. |
| Desinstalación NSIS | PASS | El asistente terminó con “INDI Asistencia ha sido desinstalado de su sistema”; el acceso directo de escritorio desapareció y la instalación previa dejó de estar disponible antes de reinstalar. |
| Estado de `userData` tras desinstalar | VERIFICADO — CONSERVADO | Ruta `C:\Users\vboxuser\AppData\Roaming\indi-asistencia-frontend`: 59 archivos. Permanecieron `sesion.enc` (642 bytes), `config.json` (40 bytes), `DIPS` (36,864 bytes), `DIPS-wal` (32 bytes), `Local State` (490 bytes), Local Storage, Session Storage, Preferences y Cookies. `terminal-sesion.enc` e IndexedDB estaban ausentes. |
| Reinstalación limpia tras desinstalar | PASS CON HALLAZGO | Se reinstaló exactamente el mismo NSIS y la app abrió sin depender del repo. En el primer inicio, sin login, restauró la sesión humana ficticia del encargado desde el `sesion.enc` conservado; no restauró Terminal. |
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
3. El NSIS conserva `userData` y una reinstalación restaura automáticamente
   la sesión humana cifrada que estaba en `sesion.enc`. En esta prueba la UI
   abrió la ruta privada del encargado sin pedir login; el backend de test
   estaba detenido, por lo que la API mostró “No se pudo conectar con el
   servidor” y no se verificó si el JWT seguía vigente. Es un riesgo de
   privacidad en equipos transferidos o reinstalados. No se cambió el
   desinstalador: borrar `userData`/invalidar sesiones requiere una decisión
   explícita de producto y seguridad.

Ambos fixes requieren que cualquier repetición manual use un instalador
generado después de esos cambios; no debe validarse con un `.exe` anterior.

## Checklist pendiente para cerrar QA Windows

1. Decidir explícitamente si uninstall debe ofrecer borrar `userData`, cerrar
   sesiones antes de desinstalar o conservar la persistencia actual.
2. Completar la inspección booleana de nombres de claves de Local Storage y
   Session Storage en Windows; los intentos no produjeron salida verificable.

Hasta completar esos puntos, el estado global es **QA WINDOWS PENDIENTE**.

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
| JWT ausente de localStorage/sessionStorage en disco Windows | NO EJECUTADO | Se preparó una inspección que solo reportaba booleanos, nombres y tamaños, pero Guest Additions no está instalado y Windows no asignó una letra accesible a la ISO de herramientas. No se obtuvo evidencia válida y no se infiere PASS del código. |
| Inspección binaria de `sesion.enc`/`terminal-sesion.enc` | NO EJECUTADO | Por la misma limitación de acceso a la VM no se pudo ejecutar la inspección no reveladora. No se imprimieron tokens ni contenido descifrado. |
| Administrador en Windows | PASS | Login ficticio abrió Dashboard; el menú empaquetado mostró Dashboard, Usuarios, Terminales y Ayuda, sin Nómina ni otras rutas financieras. |
| Recepción en Windows | PASS | Login ficticio abrió Control de asistencias; el menú mostró únicamente Asistencias y Ayuda, sin rutas financieras. |
| Encargado en Windows | PASS | Login ficticio abrió `Mi frente · hoy` / `Frente ficticio E2E`; el menú mostró únicamente Encargado y Ayuda, sin Nómina. |
| Sueldo masivo en Windows, build final | PASS | RH seleccionó exactamente Ana y Bruno ficticios; contador 2, monto `$1,234.56`, foco inicial en `Aplicar a 2` y ciclo Tab Confirmar/Cancelar verificados. La UI confirmó éxito, limpió selección y sueldo. PostgreSQL mostró Ana/Bruno en 1234.56, Control sin cambio en 800.00, nómina histórica intacta en 500.00/500.00 y 2 auditorías distintas sin el monto. |
| Desinstalación NSIS | FAIL | Se ejecutó el desinstalador real y se aprobó UAC, pero la operación quedó interrumpida/apagó la VM antes de completar. Al reiniciar, el acceso directo seguía presente y abrió la aplicación; no se demostró eliminación de ejecutables, accesos directos ni procesos. |
| Estado de `userData` tras desinstalar | NO EJECUTADO | Como el uninstall no terminó, no existe un estado posdesinstalación válido que inspeccionar. La aplicación restauró la sesión ficticia del encargado al abrirse, evidencia de que los datos de sesión previos seguían disponibles, pero no prueba qué conservaría un uninstall exitoso. |
| Reinstalación limpia tras desinstalar | NO EJECUTADO | No puede ejecutarse limpiamente mientras el uninstall real no finalice; no se marca PASS por una actualización sobre la instalación existente. |
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

Ambos fixes requieren que cualquier repetición manual use un instalador
generado después de esos cambios; no debe validarse con un `.exe` anterior.

## Checklist pendiente para cerrar QA Windows

1. Completar exitosamente el uninstall NSIS y comprobar ejecutables, accesos
   directos y procesos antes de reinstalar el mismo instalador final.
2. Inspeccionar, sin imprimir JWT, que los archivos cifrados no contienen
   texto legible y que Chromium no guarda las claves heredadas.
3. Documentar `userData` inmediatamente después del uninstall exitoso y
   comprobar si una reinstalación limpia restaura una sesión inesperadamente.

Hasta completar esos puntos, el estado global es **QA WINDOWS PENDIENTE**.

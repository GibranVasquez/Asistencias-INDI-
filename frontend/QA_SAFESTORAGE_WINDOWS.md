# QA de `safeStorage` y empaquetado en Windows

Última ejecución: 11 de agosto de 2026.

Entorno usado: Windows 11 Enterprise LTSC Evaluation 64-bit (build 26100),
VM VirtualBox 7.2, x64, usuario ficticio `vboxuser`, backend local de test y
PostgreSQL 16 efímero. No se usaron servicios, credenciales ni datos de
producción.

Build evaluado: Electron 43.1.1, NSIS x64, aplicación instalada en
`C:\Program Files\INDI Asistencia`. El instalador no tiene firma de código;
Windows muestra por ello editor desconocido/UAC. No se desactivaron UAC,
SmartScreen ni Defender.

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
| JWT ausente de localStorage/sessionStorage en disco Windows | NO EJECUTADO | Cubierto por tests/código, pero en esta sesión no se inspeccionó el LevelDB de Chromium dentro de la VM. No inferir PASS visual. |
| Inspección binaria de `sesion.enc`/`terminal-sesion.enc` | NO EJECUTADO | La restauración prueba cifrado/descifrado operativo; no se realizó una búsqueda binaria de texto para evitar imprimir accidentalmente tokens. |
| Roles administrador/recepción/encargado en Windows | NO EJECUTADO | RH sí fue probado y mostró Trabajadores/Nómina; los demás roles siguen cubiertos por E2E Linux, no por esta pasada Windows. |
| Sueldo masivo en Windows, build final | NO EJECUTADO | El primer intento descubrió un bug de foco del modal antes de tocar la API. Se corrigió y tiene regresión automatizada, pero la VM se volvió demasiado lenta para repetir el escenario completo con el instalador final. |
| Desinstalación NSIS | NO EJECUTADO | Pendiente comprobar accesos directos, procesos y conservación de `userData`. |
| Reinstalación limpia tras desinstalar | NO EJECUTADO | Hubo actualizaciones sobre una instalación existente, no un ciclo limpio de uninstall/reinstall. |
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

1. Instalar el build final en una VM limpia o completar uninstall/reinstall.
2. Inspeccionar, sin imprimir JWT, que los archivos cifrados no contienen
   texto legible y que Chromium no guarda las claves heredadas.
3. Repetir sueldo masivo con dos trabajadores ficticios en el instalador
   final y verificar el resultado en PostgreSQL de test.
4. Hacer smoke de administrador, recepción y encargado.
5. Ejecutar desinstalación, documentar si `userData` permanece y reinstalar.

Hasta completar esos puntos, el estado global es **QA WINDOWS PENDIENTE**.

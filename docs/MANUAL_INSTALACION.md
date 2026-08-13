# Manual de instalación — INDI Asistencia

Este manual corresponde al cliente Windows de la release candidate
`v0.9.0-rc.2`. No contiene credenciales ni parámetros de producción.

## Requisitos

- Windows 10/11 de 64 bits.
- Conectividad HTTPS hacia el backend autorizado por Grupo INDI.
- Permiso para instalar aplicaciones en el equipo.
- Para modo kiosco/Terminal: una Terminal previamente dada de alta por un
  administrador y la configuración operativa proporcionada por el responsable.

## Instalar

1. Obtener el instalador por el canal autorizado y comprobar su nombre y hash.
2. Ejecutar `INDI Asistencia Setup 0.9.0-rc.2.exe`.
3. Elegir la carpeta de instalación y completar el asistente NSIS.
4. Abrir **INDI Asistencia** desde el acceso directo creado.
5. Confirmar que se muestra Login o Activar Terminal, según el uso del equipo.

El RC no tiene firma digital de distribución. Windows puede mostrar editor
desconocido, SmartScreen o UAC. Verificar el SHA-256 con el responsable antes
de continuar; no desactivar Defender ni las protecciones del sistema.

SHA-256 del artefacto RC2 validado:

```text
ccea844a993506ecbac724e88752634f75af2fda1644b397de8c6d37fa3afe7d
```

## Primer inicio y conexión

La URL de API se resuelve en tiempo de ejecución. En una instalación operativa
debe ser configurada por el responsable técnico; el usuario final no debe
editar archivos internos ni copiar secretos. Si aparece “No se pudo conectar
con el servidor”, comprobar red, disponibilidad del backend y configuración con
soporte. Una pantalla explícita de mantenimiento significa que el servicio está
congelado deliberadamente y no está aceptando cambios.

## Actualizar

Cerrar la aplicación antes de ejecutar un instalador nuevo. Conservar el hash y
la versión probados como evidencia. Una actualización de versión requiere smoke
del nuevo artefacto; no extrapolar automáticamente el QA de un instalador viejo.

## Desinstalar

1. Cerrar INDI Asistencia.
2. Abrir **Aplicaciones instaladas** de Windows.
3. Seleccionar **INDI Asistencia → Desinstalar**.
4. Completar el asistente hasta el mensaje final.

La política aprobada elimina durante el uninstall el `userData` propio de INDI
Asistencia: sesiones cifradas, configuración local, Local/Session Storage y
cookies del perfil. No elimina archivos externos del usuario.

## Evidencia complementaria

La instalación, DPAPI/safeStorage, sesiones, Web Storage, mantenimiento y
desinstalación están documentados en
[`../frontend/QA_SAFESTORAGE_WINDOWS.md`](../frontend/QA_SAFESTORAGE_WINDOWS.md).

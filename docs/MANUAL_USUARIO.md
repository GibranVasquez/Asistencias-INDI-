# Manual de usuario — INDI Asistencia

Las opciones visibles dependen del rol. La palabra **Frente** se usa en la
interfaz; técnicamente el backend conserva `Seccion/seccion`.

## Acceso y sesión

1. Abrir INDI Asistencia.
2. Capturar usuario y contraseña asignados por el administrador.
3. Activar **Recordarme** solo en un equipo autorizado y personal.
4. Usar el botón de salida al terminar.

Después de inactividad el panel humano cierra su sesión. Si la contraseña fue
reseteada, la aplicación exige cambiarla antes de navegar. No compartir cuentas.

## Recursos Humanos (RH)

RH dispone de Dashboard, Incidencias, Asistencias, Trabajadores, Encargado, Nómina,
Reportes y Configuración.

- **Trabajadores:** consultar, alta/edición/baja y datos de enrolamiento.
- **Sueldo masivo:** seleccionar trabajadores activos visibles, indicar un
  monto, revisar el contador y confirmar. La operación no modifica nóminas
  históricas.
- **Asistencias:** consultar y realizar correcciones autorizadas.
- **Frentes:** asignar personal y revisar la operación del día.
- **Nómina:** previsualizar/generar la semana, movimientos, horas extra y
  exportaciones. `NominaSemanal` es un snapshot.
- **Reportes:** consultar asistencia/nómina y generar XLSX/PDF.
- **Configuración:** categorías, frentes, horarios, movimientos y tarifas
  conforme a los permisos actuales.
- **Incidencias:** consulta eventos ADMS pendientes de conciliación y navega a
  Trabajadores para revisar la asignación del identificador. La bandeja es de
  solo lectura; no modifica asistencias ni resuelve eventos por sí misma.

## Administrador

Dispone de Dashboard, Incidencias, Auditoría, Usuarios y Terminales. Puede administrar cuentas,
restablecer contraseñas, crear/editar/activar/desactivar Terminales y consultar
la bitácora disponible. No tiene acceso a Trabajadores ni Nómina; esa separación
financiera es deliberada.

## Supervisión y diagnóstico

- **Centro de incidencias:** Administrador y RH ven exclusivamente eventos
  ADMS no reconciliados que existen en PostgreSQL. No se calculan faltas,
  retardos, severidades ni anomalías de nómina en esta vista.
- **Auditoría:** solo Administrador consulta acciones registradas, ordenadas de
  la más reciente a la más antigua y paginadas. El detalle visible está
  sanitizado; no presenta contraseñas, tokens, hashes, importes ni JSON crudo.
- **Estado del sistema:** el indicador del panel significa que la API respondió
  a una comprobación de salud. **Sin conexión** no cierra la sesión y vuelve a
  comprobar automáticamente. **Mantenimiento** conserva la pantalla global
  existente. El indicador no afirma el estado individual de PostgreSQL, AWS o
  dispositivos físicos.

## Recepción

Accede a Control de asistencias para consultar la operación permitida. No tiene
acceso a Nómina, Trabajadores ni configuración financiera.

## Encargado de sección/frente

Accede a **Mi frente · hoy** para revisar el personal asignado y el resumen de
su frente. Solo puede operar los frentes que le fueron asignados y no accede a
información financiera.

## Trabajador

El rol técnico `trabajador` no entra al panel administrativo. La marcación se
realiza mediante Kiosco/Terminal o mediante el lector ADMS físico. El sistema no
ofrece autoservicio de nómina al trabajador.

## Terminal/Kiosco

Una Terminal autorizada se activa con su credencial propia. El kiosco permite
registrar asistencia o mostrar confirmaciones según su configuración. La sesión
se guarda cifrada mediante `safeStorage`; desvincular elimina esa sesión. No hay
cola offline: si el sistema está en mantenimiento, el kiosco no simula éxito ni
guarda marcaciones para enviarlas después.

## Mensajes frecuentes

- **Credenciales incorrectas:** revisar usuario/contraseña; la respuesta no
  revela si una cuenta inexistente fue la causa.
- **Cuenta bloqueada:** esperar el periodo indicado o solicitar apoyo.
- **No se pudo conectar:** revisar red y contactar soporte.
- **Sistema temporalmente en mantenimiento:** no se registran cambios; esperar
  a que el responsable reactive el servicio.
- **Sin permisos:** volver al menú permitido; las rutas se validan también en
  backend.

## Soporte

Usar **Ayuda y soporte**. Los datos de contacto mostrados por la aplicación
deben ser confirmados por Grupo INDI antes de operación definitiva.

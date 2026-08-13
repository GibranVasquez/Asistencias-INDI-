# Checklist de entrega

Esta lista separa evidencia académica de actividades necesarias para operar en
campo. No sustituye los requisitos oficiales de la institución o del cliente.

## A. Entrega de residencia

### Ya existe

- [x] Código fuente backend, frontend e infraestructura.
- [x] README de desarrollo y mapa documental.
- [x] Manual de instalación Windows.
- [x] Manual de usuario por rol.
- [x] Documento de arquitectura.
- [x] Auditoría técnica de RC2.
- [x] Evidencia de pruebas unitarias, integración, E2E y QA Windows.
- [x] Instalador RC `v0.9.0-rc.2` con SHA-256 registrado.
- [x] Runbook y rehearsal de migración México.

### Existe parcialmente o fuera del formato académico final

- [ ] Informe técnico de residencia: consolidar objetivos, metodología,
  resultados, conclusiones y referencias según plantilla institucional.
- [ ] Diagramas para memoria académica: seleccionar/adaptar los diagramas
  técnicos existentes al formato del informe.
- [ ] Evidencia visual: organizar capturas y resultados sin datos sensibles.
- [ ] Reporte semanal/bitácora: existe historial técnico en Git/NOTES/CLAUDE;
  transformarlo solo si la institución pide un formato específico.

### No localizado en el repositorio

- [ ] Presentación final académica.
- [ ] Carta de aceptación/liberación u otros formatos administrativos.
- [ ] Rúbrica o lista oficial de entregables del Instituto Tecnológico.

## B. Producción real

- [ ] Obtener y configurar el hardware biométrico físico autorizado.
- [ ] Ejecutar QA ADMS con serial, enrollment, huella/rostro, ATTLOG,
  reintentos, desconexión, duplicados, allowlist y recuperación.
- [ ] Confirmar IP pública/allowlist real y contacto de soporte.
- [ ] Confirmar horarios, categorías/sueldos, tarifa de hora extra y otros
  datos operativos con RH.
- [ ] Obtener definición RH/legal antes de desarrollar finiquitos.
- [ ] Completar asesoría legal aplicable a tratamiento de datos biométricos.
- [ ] Autorizar ventana, backup, congelamiento, restore y corte AWS México.
- [ ] Ejecutar migración productiva, checksums, DNS y observación.
- [ ] Mejorar retención de backups RDS conforme a política aprobada.
- [ ] Definir firma de código/canal de distribución del instalador estable.
- [ ] Sustituir datos placeholder de Ayuda y soporte.
- [ ] Resolver o aceptar formalmente riesgos técnicos abiertos antes de la
  release estable.

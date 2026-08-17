# Glosario del dominio operativo

Este glosario distingue los términos confirmados por el modelo actual de los
que todavía requieren validación con RH y operación. La lista física usada
como referencia orienta la presentación, pero no define por sí sola el modelo
de datos.

## Términos confirmados

| Término visible | Equivalente técnico actual | Fuente |
| --- | --- | --- |
| Trabajador | `Trabajador` | Base de datos y API de trabajadores |
| Asistencia / marcación | `AsistenciaDiaria` | API `/asistencias` |
| Entrada / salida | Marcaciones ordenadas por hora | Presentación; el registro actual no guarda tipo de evento |
| Frente | `Seccion` | `AsistenciaDiaria.seccionId` y nombre denormalizado |
| Turno | `AsistenciaDiaria.turno` | API de asistencias |
| Horario | `Horario` asociado a una sección | Catálogo de horarios |
| Semana | Rango de siete fechas | Derivado en frontend, sin nueva columna |
| Método | `metodoUsado` (`huella`/`rostro`) | API de asistencias |
| Estado de huella | `huellaRegistrada` | Trabajador; solo estado, nunca plantilla biométrica |
| Terminal | `Terminal` y `terminalOrigenId` | Registro de asistencia |
| Nómina | `NominaSemanal` | API y modelo existentes |

## Términos que no deben fusionarse sin definición

- **Área, tramo y ubicación:** no son campos independientes en el modelo
  actual. No se presentan como datos inventados.
- **Responsable:** una sección puede tener usuarios encargados, pero el
  endpoint de asistencias no devuelve ese dato. Su presentación requiere una
  consulta autorizada o una definición de negocio.
- **Puesto:** el modelo actual usa `Trabajador.categoria`, texto libre. No hay
  una entidad `Puesto` separada.
- **Entrada y salida:** una asistencia solo contiene fecha y hora; no existe un
  tipo de evento formal para afirmar cuál de las dos es.
- **Falta, retardo y descanso:** no se muestran como reglas automáticas en la
  lista semanal porque RH no ha definido reglas formales para derivarlos.

## Criterios de la lista semanal

La vista semanal reutiliza `GET /asistencias` con `fechaInicio`, `fechaFin` y
`seccionId`. Agrupa en memoria por trabajador y fecha, conserva todas las horas
recibidas y muestra `Sin registro` cuando no hay marcación. No crea columnas,
migraciones ni escrituras nuevas.

El estado de enrolamiento biométrico se mantiene como un dato operativo de
trabajador (`Enrolado`/`No enrolado` cuando la pantalla correspondiente lo
exponga). El backend no almacena plantillas de huella o rostro.

## Pendientes de validación

- Qué diferencia operativamente un frente, tramo, área y ubicación.
- Catálogo oficial de puestos/categorías de obra.
- Responsable de tramo y alcance de sus permisos.
- Reglas aprobadas para falta, retardo, descanso y entrada/salida.
- Formato requerido para impresión o exportación de la lista semanal.

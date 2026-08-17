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
| Entrada / salida | Primera y última marcación del día | Presentación; el registro actual no guarda tipo de evento |
| Frente | `Seccion` | `AsistenciaDiaria.seccionId` y nombre denormalizado |
| Turno | `AsistenciaDiaria.turno` | API de asistencias |
| Horario | `Horario` asociado a una sección | Catálogo de horarios |
| Semana | Rango de siete fechas | Derivado en frontend, sin nueva columna |
| Método | `metodoUsado` (`huella`/`rostro`) | API de asistencias |
| Estado de huella | `huellaRegistrada` | Trabajador; solo estado, nunca plantilla biométrica |
| Terminal | `Terminal` y `terminalOrigenId` | Registro de asistencia |
| Nómina | `NominaSemanal` | API y modelo existentes |
| Área / proyecto | `Obra.nombre` | Configuración de la obra y encabezado de asistencia |
| ID | Identificador operativo secuencial de la lista | Presentación; confirmar equivalencia con el identificador empresarial |

## Términos que no deben fusionarse sin definición

- **Área, tramo y ubicación:** no son campos independientes en el modelo
  actual. No se presentan como datos inventados.
- **Responsable del tramo:** cuentas de usuario relacionadas con
  `Seccion.encargados`; el rol técnico continúa siendo `encargado_seccion`.
  Cuando la cuenta tiene un trabajador vinculado, la interfaz muestra también
  su nombre y categoría. El modelo actual no permite asignar directamente a
  cualquier `Trabajador` sin una cuenta; esa decisión de negocio queda
  pendiente de validación con RH.
- **Puesto:** el modelo actual usa `Trabajador.categoria`, texto libre. No hay
  una entidad `Puesto` separada.
- **Entrada y salida:** una asistencia solo contiene fecha y hora; no existe un
  tipo de evento formal para afirmar cuál de las dos es.
- **Falta, retardo y descanso:** no se muestran como reglas automáticas en la
  lista semanal porque RH no ha definido reglas formales para derivarlos.

## Criterios de la lista semanal

La vista semanal reutiliza `GET /asistencias` con `fechaInicio`, `fechaFin`,
`seccionId`, `turno` y `categoria`. El backend devuelve en una sola consulta el
área (`Obra.nombre`), tramo, responsables, horario, categoría y estado de
huella. La exportación de solo lectura está disponible en
`/asistencias/lista-semanal/exportar` para PDF y Excel.

El estado de enrolamiento biométrico se mantiene como un dato operativo de
trabajador (`Enrolado`/`No enrolado` cuando la pantalla correspondiente lo
exponga). El backend no almacena plantillas de huella o rostro.

## Pendientes de validación

- Qué diferencia operativamente un frente, tramo, área y ubicación.
- Catálogo oficial de puestos/categorías de obra.
- Responsable de tramo y alcance de sus permisos.
- Reglas aprobadas para falta, retardo, descanso y entrada/salida.
- Formato requerido para impresión o exportación adicional de la lista semanal.
- Confirmar con RH si `Puesto` y `Categoría` son conceptos separados; por ahora se
  presenta como **Puesto / categoría** porque el modelo solo tiene
  `Trabajador.categoria`.
- Confirmar qué identificador empresarial debe representar la columna **ID**.

## Configuración de la obra

La entidad `Obra` es la única fuente de verdad para el nombre visible del área o
proyecto. La pestaña **Datos de la obra** está disponible en Configuración; RH
puede consultarla y solo Administrador puede modificarla. El endpoint de
escritura valida el rol en backend y registra la modificación en auditoría.

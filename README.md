# Sistema de Asistencia y Nómina — Grupo INDI

## Descripción

Sistema de asistencia biométrica y nómina para la obra Tren Golfo de México
de Grupo INDI. Los clientes de escritorio se distribuyen con Electron; el
backend es una API Node.js/Express conectada a PostgreSQL. El proyecto también
recibe marcaciones de equipos ZKTeco mediante el protocolo ADMS.

## Arquitectura

```text
Electron / React
       |
       | HTTPS
       v
  Express API
       |
       v
  PostgreSQL
```

Los lectores compatibles envían marcaciones directamente al backend:

```text
ZKTeco
   |
   | ADMS / HTTP
   v
/iclock/*
   |
   v
Backend
```

## Stack

Backend:

- Node.js y TypeScript
- Express 5
- Prisma
- PostgreSQL

Frontend:

- Electron
- React
- TypeScript
- electron-vite

Infraestructura:

- AWS ECS/Fargate
- Application Load Balancer (ALB)
- RDS
- WAF
- Route 53
- ACM

## Estructura del repositorio

- `backend/`: API, modelo Prisma, migraciones, seed y exportadores.
- `frontend/`: aplicación Electron, preload y renderer React.
- `infra/`: Terraform, red AWS y documentación de migración regional.
- `docs/`: insumos y documentación operativa complementaria.

## Desarrollo local

Instalar y arrancar el backend:

```bash
cd backend
npm install
npm run dev
```

Instalar y arrancar el frontend:

```bash
cd frontend
npm install
npm run dev
```

Verificaciones y tareas disponibles:

```bash
# backend/
npm run build
npm run typecheck:prisma
npm test
npm run test:integration
npm run lint
npm run migration:test:guards
npm run migration:test
npm run prisma:generate
npm run prisma:migrate
npm run seed

# frontend/
npm run typecheck
npm run build
npm test
npm run lint
npm run test:e2e
```

`npm run prisma:migrate` ejecuta `prisma migrate dev`; debe usarse contra el
entorno local de desarrollo, no como mecanismo automático de despliegue.

## Variables de entorno

Copiar los archivos de ejemplo y completar valores propios del entorno:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Los archivos `.env` reales no deben commitearse. Los ejemplos documentan la
forma esperada de cada variable sin contener credenciales válidas.

`MAINTENANCE_MODE=false` mantiene la operación normal. `true` congela la API
completa salvo `/health` para cortes controlados; no es un secreto y requiere
reiniciar/desplegar todas las instancias con la misma configuración.

## Roles

El modelo actual define estos roles:

- `trabajador`
- `recepcion`
- `encargado_seccion`
- `rh`
- `administrador`

Los permisos se aplican por ruta en el backend y el menú del frontend se
filtra por rol. Consultar el código actual antes de cambiar esa matriz.

## Asistencia

Las marcaciones llegan desde dos fuentes:

- Kiosco Electron autenticado como terminal.
- Lector ZKTeco de oficina mediante ADMS sobre `/iclock/*`.

La integración ADMS está implementada y probada con peticiones simuladas; la
validación completa contra el equipo físico continúa pendiente.

## Nómina

Las reglas cerradas actualmente son:

- Sueldo: `sueldoBase / 7 * días laborados`.
- Horas extra con tarifa configurable.
- Movimientos del trabajador que participan en el cálculo según su catálogo.
- `NominaSemanal` conserva un snapshot; cambios posteriores a catálogos o
  `sueldoBase` no reescriben nóminas históricas.

Las reglas de finiquito todavía no están definidas y no forman parte de esta
documentación.

## Documentación adicional

- [Guía técnica para agentes](CLAUDE.md)
- [Notas del historial Git](NOTES.md)
- [Migración regional de AWS](infra/AWS_MIGRATION.md)
- [QA de safeStorage en Windows](frontend/QA_SAFESTORAGE_WINDOWS.md)
- [Manual de instalación](docs/MANUAL_INSTALACION.md)
- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Arquitectura técnica](docs/ARQUITECTURA.md)
- [Checklist de entrega](docs/CHECKLIST_ENTREGA.md)
- [Auditoría técnica de RC2](AUDITORIA_PROYECTO.md)

## Estado del proyecto

La release candidate local actual es `v0.9.0-rc.2`. El backend está desplegado
en producción sobre AWS. La migración regional de
`us-east-1` a `mx-central-1` continúa en curso: México dispone de un stack
paralelo, pero faltan la migración final de datos, validación y corte DNS. La
integración ADMS física aún requiere validación completa y el sistema sigue en
desarrollo activo.

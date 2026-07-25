# Migración a AWS (App Runner + RDS) — preparación, no ejecución

**Estado real (2026-07-24): nada de esto está aplicado.** No existe cuenta
de AWS. La base de datos real sigue siendo Supabase — no se toca hasta que
la infraestructura de AWS exista y esté probada. Este documento es la
checklist a seguir cuando llegue ese momento, para que sea "seguir una
lista", no reinventar cada decisión de nuevo.

Los archivos de Terraform viven en `terraform/` (stack principal) y
`terraform-bootstrap/` (backend remoto de estado, ver paso 0). Ver
`terraform/README.md` para el razonamiento de las decisiones de diseño —
RDS Proxy, certificado SSL, generación de secrets. Este archivo es la
checklist operativa; ese otro es el porqué de cada decisión.

## 0. Backend remoto de Terraform — PRIMER paso real, antes que cualquier otro recurso

El `state` del stack principal (`terraform/`) va a contener el password de
RDS y el JWT_SECRET **en texto plano** — comportamiento normal y esperado
de `random_password` (Terraform guarda el resultado en claro en el state),
no un bug a corregir. Por eso el backend remoto no es opcional ni algo
para "después": es el primer recurso real que se aplica, antes de tocar
`terraform/` para nada más que `validate`.

- [ ] `cd infra/terraform-bootstrap && terraform init && terraform apply`
      — crea el bucket S3 (versionado, cifrado SSE-S3, sin acceso público)
      y la tabla DynamoDB de locking. Este apply usa state **local**
      (seguro de dejar en disco: no contiene ningún secreto, solo la
      definición de un bucket y una tabla vacíos) — ver
      `terraform-bootstrap/README.md`.
- [ ] `terraform output` ahí mismo → copiar `bucket_name` y
      `dynamodb_table_name`.
- [ ] En `terraform/versions.tf`, descomentar el bloque `backend "s3" {
      ... }` y reemplazar `<bucket>`/`<tabla>`/`<region>` por esos valores
      reales.
- [ ] `cd terraform && terraform init` — Terraform va a ofrecer migrar el
      state (local, probablemente vacío a esta altura) hacia S3; aceptar.

## 1. Cuenta de AWS y red

Antes de tocar Terraform:
- [ ] Cuenta de AWS creada.
- [ ] VPC con al menos 2 subnets **privadas** en AZs distintas (RDS y el
      VPC Connector de App Runner las necesitan — ver `variables.tf`,
      `private_subnet_ids`).
- [ ] Confirmar la versión real de Postgres disponible en la región
      elegida: `aws rds describe-db-engine-versions --engine postgres
      --region <region>` — el default en `variables.tf`
      (`db_engine_version = "17.4"`) es una suposición basada en que
      Supabase corre Postgres 17.6 hoy, no una versión confirmada contra
      RDS.

## 2. Permisos IAM para quien corre Terraform

**No usar un usuario con `IAMFullAccess`/`AdministratorAccess` para
esto.** `terraform/iam-provisioning-policy.json` tiene una política
acotada a exactamente los servicios que este Terraform toca (RDS, App
Runner, ECR, Secrets Manager, EC2 — solo VPC/SG —, S3+DynamoDB del
bootstrap, y IAM **solo** para crear/gestionar los 2 roles de servicio que
el propio stack necesita, restringido por prefijo de nombre — no gestión
de usuarios, políticas globales, ni roles fuera de ese prefijo). Ver el
razonamiento completo y qué se excluye deliberadamente en
`terraform/README.md`, sección "Permisos IAM de aprovisionamiento".

- [ ] Crear el usuario/rol de IAM que va a correr `terraform apply` con
      esa política adjunta (no una más amplia).

## 3. Variables a llenar en `terraform.tfvars`

Copiar `terraform/terraform.tfvars.example` → `terraform/terraform.tfvars`
(gitignoreado) y llenar:

| Variable | De dónde sale |
|---|---|
| `aws_region` | Decisión del usuario — candidata razonable: `us-east-1` (misma región que Supabase hoy, para minimizar latencia si hay una ventana de doble-escritura durante la migración de datos) |
| `vpc_id` | De la VPC creada en el paso 1 |
| `private_subnet_ids` | De las subnets privadas del paso 1 (mínimo 2) |
| `adms_ips_permitidas` | IP pública real de la oficina de Grupo INDI (donde vive el MB10-VL) — sin default, ver sección ADMS en el CLAUDE.md principal para el porqué |

El resto de variables (`db_instance_class`, `apprunner_cpu`,
`allowed_origin`, etc.) ya tienen defaults razonables en `variables.tf` —
solo sobreescribirlas si hay una razón concreta.

## 4. Imagen del backend

- [ ] `terraform apply -target=aws_ecr_repository.backend` (o el apply
      completo, aceptando que App Runner falle la primera vez si la
      imagen todavía no existe).
- [ ] `docker build -t <ecr_repository_url>:latest backend/`
- [ ] `docker push <ecr_repository_url>:latest`
- [ ] `terraform apply` (completo, con la imagen ya subida).

El Dockerfile (`backend/Dockerfile`) ya está escrito y **probado en este
entorno de desarrollo**: build real + contenedor corrido de verdad contra
la base de Supabase actual (login + `/health` respondieron correctamente
desde dentro del contenedor), y se inspeccionaron las capas de la imagen
(`docker history` + listado del filesystem) para confirmar que no se
coló ningún archivo con secretos de desarrollo (`.env`, etc.) — no es solo
teoría de que "debería funcionar".

## 5. Migraciones de schema

Mismo patrón manual que se decidió para Railway (ver `CLAUDE.md`, sección
"Despliegue"): `npx prisma migrate deploy` desde una máquina de
desarrollo apuntando a la nueva base RDS, **antes** de que el servicio de
App Runner reciba tráfico real por primera vez. `DIRECT_URL` y
`DATABASE_URL` van a apuntar al mismo endpoint en RDS (sin RDS Proxy, no
hay distinción pooled/directa — ver `terraform/README.md`).

## 6. Certificado SSL de RDS — código preparado, pendiente de probar en vivo

`backend/certs/rds-global-bundle.pem` ya está descargado y verificado
(paquete público oficial de AWS,
`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`, 108
certificados — confirmado que parsean como certificados X.509 válidos).
**`src/utils/prisma.ts` NO se modificó todavía** — sigue apuntando 100% a
Supabase, tal como se pidió.

Cuando exista una instancia RDS real y sea momento de cortar, el cambio en
`src/utils/prisma.ts` es análogo al que ya existe para Supabase — mismo
patrón, apuntando a otro archivo:

```ts
// Reemplazar esto (Supabase):
const caSupabase = readFileSync(join(__dirname, "..", "..", "certs", "supabase-root-2021-ca.pem"));
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: caSupabase.toString() },
});

// Por esto (RDS):
const caRds = readFileSync(join(__dirname, "..", "..", "certs", "rds-global-bundle.pem"));
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: caRds.toString() },
});
```

**Pendiente explícito, no resuelto por este documento:** repetir en vivo,
contra la instancia RDS real, la misma prueba de rigor que se hizo para el
CA de Supabase — sustituir el `.pem` por un CA real pero de otra autoridad
y confirmar que la conexión **falla** con error de validación de cadena
(no solo que "conecta", sino que de verdad está validando). No se puede
hacer esa prueba todavía porque no existe una instancia RDS contra la cual
probar.

## 7. Variables de entorno / secrets finales en App Runner

Ya quedan resueltas automáticamente por Terraform (`apprunner.tf`) — no
hay que configurarlas a mano en ninguna consola:

| Variable | Origen |
|---|---|
| `DATABASE_URL` | Secrets Manager, generado por Terraform |
| `DIRECT_URL` | Mismo secret que `DATABASE_URL` |
| `JWT_SECRET` | Secrets Manager, generado por Terraform (`random_password`, nunca escrito a mano) |
| `NODE_ENV` | `"production"` (variable `node_env`) |
| `ALLOWED_ORIGIN` | Placeholder por default (ver `terraform/README.md` — no protege al cliente Electron real de todos modos) |
| `JWT_EXPIRES_IN` | `"8h"` por default |
| `JWT_EXPIRES_IN_TERMINAL` | `"30d"` por default |
| `ADMS_IPS_PERMITIDAS` | Sale de `var.adms_ips_permitidas` — **este SÍ hay que llenarlo con la IP pública real de la oficina** (ver paso 3), no tiene un placeholder seguro como `allowed_origin`: sin él, `/iclock/*` rechaza todo en producción (fail-closed) |
| `PORT` | Igual al puerto configurado del contenedor (`container_port`, default 4000) |

Lo único que el usuario sigue teniendo que decidir/llenar a mano es lo del
paso 3 (`aws_region`, `vpc_id`, `private_subnet_ids`, `adms_ips_permitidas`)
— el resto sale del `apply`.

## 8. Migración de datos real (el último paso, no el primero)

Cuando App Runner + RDS estén desplegados, probados, y con las migraciones
de schema aplicadas — **recién ahí** se planea el corte de datos real
desde Supabase (dump/restore o alguna estrategia de doble-escritura
temporal). No está planeado en detalle todavía a propósito: no tiene
sentido diseñar esa parte hasta confirmar que la infraestructura nueva
funciona de punta a punta con datos de prueba.

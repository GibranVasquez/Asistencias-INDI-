# Migración regional AWS (ECS/Fargate + ALB + RDS) — ejecución parcial

**2026-07-28: reemplazado App Runner por ECS (Fargate + ALB a mano).**
App Runner dejó de aceptar clientes nuevos desde el 30 de abril de 2026
(confirmado con la documentación oficial de AWS) y esta cuenta nunca lo
había usado — no es un problema de configuración, es una política de
producto sin mecanismo de reversión. Se descartó también "ECS Express
Mode" (el reemplazo más simple que AWS recomienda) tras encontrar 7 bugs
reales documentados en el CHANGELOG del provider de Terraform para ese
recurso en sus primeras ~4 semanas de vida — ver `terraform/ecs.tf` y
`CLAUDE.md` para el detalle completo de ambas decisiones.

**Estado actual (2026-08-08):** `us-east-1` mantiene la producción funcional
y `mx-central-1` ya tiene un stack paralelo desplegado. La migración continúa
abierta hasta completar la transferencia final de datos, sus checksums, el
corte DNS, la validación posterior y la limpieza controlada de `us-east-1`.
Este documento conserva la checklist operativa y el historial de pasos ya
ejecutados; las casillas antiguas no implican que la infraestructura siga sin
existir.

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
- [ ] VPC con al menos 2 subnets **privadas** en AZs distintas (RDS y las
      tasks de ECS/Fargate las necesitan — ver `variables.tf`,
      `private_subnet_ids`) **y** al menos 2 subnets **públicas** en AZs
      distintas (el Application Load Balancer las necesita — ver
      `public_subnet_ids`). `infra/terraform-network/` ya crea ambos
      tipos.
- [ ] Confirmar la versión real de Postgres disponible en la región
      elegida: `aws rds describe-db-engine-versions --engine postgres
      --region <region>` — el default en `variables.tf`
      (`db_engine_version = "17.4"`) es una suposición basada en que
      Supabase corre Postgres 17.6 hoy, no una versión confirmada contra
      RDS.

## 2. Permisos IAM para quien corre Terraform

**No usar un usuario con `IAMFullAccess`/`AdministratorAccess` para
esto.** `terraform/iam-provisioning-policy-datos.json` +
`terraform/iam-provisioning-policy-compute.json` (dos políticas
separadas desde 2026-07-28 por el límite de 6144 caracteres de AWS por
política — ver `terraform/README.md`) acotan los permisos a exactamente
los servicios que este Terraform toca (RDS, ECS/Fargate, ALB, Route 53,
ACM, ECR, Secrets Manager, EC2 — solo VPC/SG —, S3+DynamoDB del
bootstrap, y IAM **solo**
para crear/gestionar los roles de servicio que el propio stack
necesita, restringido por prefijo de nombre — no gestión de usuarios,
políticas globales, ni roles fuera de ese prefijo). Ver el razonamiento
completo, qué se excluye deliberadamente, y qué permiso va en cuál
archivo en `terraform/README.md`, sección "Permisos IAM de
aprovisionamiento".

- [ ] Crear el usuario/rol de IAM que va a correr `terraform apply` con
      esa política adjunta (no una más amplia).

## 3. Variables a llenar en `terraform.tfvars`

Copiar `terraform/terraform.tfvars.example` → `terraform/terraform.tfvars`
(gitignoreado) y llenar:

| Variable | De dónde sale |
|---|---|
| `aws_region` | Decisión del usuario — candidata razonable: `us-east-1` (misma región que Supabase hoy, para minimizar latencia si hay una ventana de doble-escritura durante la migración de datos) |
| `vpc_id` | De la VPC creada en el paso 1 (`infra/terraform-network/`, output `vpc_id`) |
| `private_subnet_ids` | De las subnets privadas del paso 1 (mínimo 2, output `private_subnet_ids`) |
| `public_subnet_ids` | De las subnets públicas del paso 1 (mínimo 2, output `public_subnet_ids`) — para el ALB |
| `root_domain_name` | Dominio raíz real del usuario (ej. comprado en Namecheap) — ver paso 4, sección del dominio, **antes** de llenar esto |
| `adms_ips_permitidas` | IP pública real de la oficina de Grupo INDI (donde vive el MB10-VL) — sin default, ver sección ADMS en el CLAUDE.md principal para el porqué |

El resto de variables (`db_instance_class`, `backend_cpu`,
`allowed_origin`, etc.) ya tienen defaults razonables en `variables.tf` —
solo sobreescribirlas si hay una razón concreta.

## 4. Dominio y certificado HTTPS — orden OBLIGATORIO, no opcional

El backend se expone en `https://api.${root_domain_name}` vía un
Application Load Balancer (`terraform/ecs.tf` + `terraform/dns.tf`). El
dominio se compra fuera de Terraform — la zona de Route 53 se crea como
recurso propio (`aws_route53_zone`, no un `data source` de una zona ya
existente), así que Terraform controla tanto la zona como el registro de
validación de ACM dentro de ella. **El único paso genuinamente manual es
la delegación de NS hacia el registrador** — eso cruza de AWS a un
proveedor externo (Namecheap u otro), Terraform no puede tocarlo.

- [ ] Comprar el dominio (si todavía no existe uno) en el registrador que
      sea.
- [ ] Llenar `root_domain_name` en `terraform.tfvars`.
- [ ] `terraform apply -target=aws_route53_zone.this` — **solo** la zona,
      todavía sin certificado ni nada más del stack.
- [ ] `terraform output route53_name_servers` → copiar esos 4 NS **exactos**
      a la configuración de nameservers del dominio en el registrador
      (ej. Namecheap: Domain List → Manage → Nameservers → Custom DNS).
- [ ] **Esperar propagación real antes de seguir** — verificar con:
      ```bash
      dig NS <tu-dominio> +short
      # o:
      nslookup -type=NS <tu-dominio> 8.8.8.8
      ```
      hasta que los 4 NS que devuelva coincidan con los de Route 53. Si
      se aplica el certificado (paso 5 en adelante) **antes** de que esto
      propague públicamente, la validación de ACM se queda esperando
      indefinidamente un registro DNS que sus propios servidores de
      validación todavía no pueden ver — no es una condición de carrera
      de Terraform, es que la delegación de NS real todavía no es visible
      para el resto de internet. La propagación puede tardar de minutos a
      ~48h dependiendo del registrador y el TTL previo del dominio.

## 5. Imagen del backend

**Orden recomendado, no tan estricto como con App Runner** — a
diferencia de `CreateService` de App Runner (que fallaba directo con
`CREATE_FAILED` si no podía hacer `pull` de la imagen), `aws_ecs_service`
sí se puede crear sin que la imagen exista todavía: el servicio queda
creado, las tasks simplemente fallan al arrancar y ECS reintenta solo. De
todos modos, para no generar ruido/alarmas de tasks fallidas innecesarias,
sigue el mismo orden:

- [ ] `terraform apply -target=aws_ecr_repository.backend` — solo el
      repositorio ECR, todavía sin nada más del stack.
- [ ] Autenticar Docker contra ECR (obligatorio, sin esto el `push` falla
      por permisos aunque el repositorio ya exista — el token expira a
      las 12h, hay que repetir este paso si pasa ese tiempo entre esto y
      el `push`):
      ```bash
      aws ecr get-login-password --profile indi-produccion --region us-east-1 \
        | docker login --username AWS --password-stdin <account_id>.dkr.ecr.us-east-1.amazonaws.com
      ```
- [ ] `docker build -t <ecr_repository_url>:latest backend/`
- [ ] `docker push <ecr_repository_url>:latest`
- [ ] `terraform apply` (completo — con el dominio ya propagado del paso
      4 y la imagen real ya subida).
- [ ] Si alguna vez hay que forzar un redeploy tras subir una imagen
      nueva sin cambiar nada más en Terraform: `aws ecs update-service
      --cluster <cluster> --service <service> --force-new-deployment`.

El Dockerfile (`backend/Dockerfile`) ya está escrito y **probado en este
entorno de desarrollo**: build real + contenedor corrido de verdad contra
la base de Supabase actual (login + `/health` respondieron correctamente
desde dentro del contenedor), y se inspeccionaron las capas de la imagen
(`docker history` + listado del filesystem) para confirmar que no se
coló ningún archivo con secretos de desarrollo (`.env`, etc.) — no es solo
teoría de que "debería funcionar".

## 6. Migraciones de schema

Mismo patrón manual que se decidió para Railway (ver `CLAUDE.md`, sección
"Despliegue"): `npx prisma migrate deploy` desde una máquina de
desarrollo apuntando a la nueva base RDS, **antes** de que el servicio de
ECS reciba tráfico real por primera vez. `DIRECT_URL` y
`DATABASE_URL` van a apuntar al mismo endpoint en RDS (sin RDS Proxy, no
hay distinción pooled/directa — ver `terraform/README.md`), accedido vía
el túnel SSM del bastión (`infra/terraform-network/`), ya que RDS vive en
subredes privadas.

**IMPORTANTE — el motor de migraciones de Prisma (CLI) NO usa el mismo
`ssl: { ca: ... }` explícito que `src/utils/prisma.ts` usa en runtime.**
Ese pinneo de CA vive en código de la app (`@prisma/adapter-pg`, JS puro);
`prisma migrate deploy` corre con su propio motor (Rust), que solo lee los
parámetros de la propia connection string. **Bug real confirmado en vivo
2026-07-30:** un `DATABASE_URL`/`DIRECT_URL` con solo `?sslmode=require`
(el patrón que se venía usando para correr migraciones/`psql` manual
contra RDS vía el túnel) conecta sin validar ningún certificado — cifra
la conexión, pero no autentica al servidor. Confirmado con la misma
prueba positiva/negativa que ya se hizo para el CA de Supabase: un
`sslrootcert` equivocado (`supabase-root-2021-ca.pem`) contra RDS falla
explícito con "certificate verify failed"; el correcto
(`rds-global-bundle.pem`) conecta bien.

**Forma correcta, para cualquier `psql`/`prisma migrate deploy` manual
contra RDS de aquí en adelante** (conectando directo al endpoint real de
RDS, no via el hostname `localhost` del túnel — `verify-full` sí valida
hostname además de la cadena):

```
postgresql://<usuario>:<password>@<endpoint-real-de-rds>:5432/<db>?sslmode=verify-full&sslrootcert=/ruta/absoluta/a/backend/certs/rds-global-bundle.pem
```

Si se conecta a través de `localhost` (túnel SSM local, puerto reenviado)
en vez del hostname real, usar `sslmode=verify-ca` en su lugar —
`verify-full` fallaría por mismatch de hostname aunque el CA sea
correcto, ya que el certificado real es para el dominio de RDS, no para
`localhost`.

## 7. Certificado SSL de RDS — código preparado, pendiente de probar en vivo

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

## 8. Variables de entorno / secrets finales en la task definition de ECS

Ya quedan resueltas automáticamente por Terraform (`terraform/ecs.tf`) —
no hay que configurarlas a mano en ninguna consola:

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
paso 3 (`aws_region`, `vpc_id`, `private_subnet_ids`, `public_subnet_ids`,
`root_domain_name`, `adms_ips_permitidas`) — el resto sale del `apply`.

## 9. Migración de datos real (el último paso, no el primero)

Cuando ECS + RDS estén desplegados, probados, y con las migraciones
de schema aplicadas — **recién ahí** se planea el corte de datos real
desde Supabase (dump/restore o alguna estrategia de doble-escritura
temporal). No está planeado en detalle todavía a propósito: no tiene
sentido diseñar esa parte hasta confirmar que la infraestructura nueva
funciona de punta a punta con datos de prueba.

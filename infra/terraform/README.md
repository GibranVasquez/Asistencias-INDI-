# Terraform — AWS (App Runner + RDS)

**Estado: preparación, nada aplicado.** No existe cuenta de AWS todavía.
Estos archivos describen la infraestructura objetivo; no se ha corrido
`terraform plan` ni `terraform apply` contra ninguna cuenta real — solo
`terraform validate` (sintaxis) contra un backend local. Ver
`../AWS_MIGRATION.md` para la checklist completa de qué hace falta llenar
antes del primer apply real, y para el plan de corte de Supabase → RDS
(que **no ha pasado todavía** — Supabase sigue siendo la base real).

## Decisión: sin RDS Proxy

App Runner corre el backend como un proceso Node persistente por
instancia (no serverless por-petición como Lambda), y ya usamos un pool de
conexiones nativo (`@prisma/adapter-pg` → `pg.Pool`) contra el pooler de
Supabase hoy, sin problema.

**RDS Proxy no se incluye** en esta primera versión. Razonamiento:

- El problema que RDS Proxy resuelve — explosión de conexiones por
  *muchísimos* procesos cortos abriendo/cerrando conexión constantemente
  (el patrón clásico de Lambda) — no aplica aquí: App Runner con
  `apprunner_min_instances=1`/`apprunner_max_instances=3` (ver
  `variables.tf`) son a lo sumo un puñado de procesos *persistentes*, cada
  uno con su propio pool interno modesto (default de `pg.Pool`, ~10
  conexiones). El total nunca se acerca al límite de conexiones de una
  instancia `db.t4g.micro` incluso con las 3 instancias de App Runner
  escaladas a la vez.
- La escala real del proyecto (~137 trabajadores, uso interno de oficina,
  sin tráfico público) hace muy improbable que App Runner escale
  seguido más allá de 1 instancia.
- RDS Proxy tiene costo propio (facturado por vCPU de la instancia
  subyacente) y una capa más de infraestructura que monitorear/entender —
  no se justifica para este volumen.
- El otro beneficio real de RDS Proxy (suavizar un failover de Multi-AZ)
  tampoco aplica todavía: `db_multi_az = false` por default (ver
  `variables.tf`), por el mismo criterio de escala/costo.

**Reconsiderar esto si:** el proyecto agrega componentes serverless
(Lambda) que sí generarían el patrón de conexión que RDS Proxy resuelve,
si App Runner empieza a escalar a varias instancias de forma habitual, o
si se activa Multi-AZ.

## Certificado SSL de RDS — preparado, no verificado en vivo

`backend/certs/rds-global-bundle.pem` ya está descargado (el bundle
combinado público de AWS, `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`,
108 certificados, uno de ellos siendo la CA raíz de cada región de RDS —
se usa el bundle global completo, no uno regional, porque todavía no
sabemos en qué región va a vivir la instancia real). **El código de
`src/utils/prisma.ts` NO se tocó** — sigue apuntando 100% a Supabase, tal
como se pidió explícitamente. El patrón que va a reemplazarlo cuando haya
una instancia RDS real está documentado en `../AWS_MIGRATION.md`, junto
con el pendiente explícito de repetir la prueba negativa (CA equivocado →
la conexión debe fallar) que sí se hizo en vivo para el CA de Supabase.

## Secrets — generados, no escritos a mano

- `JWT_SECRET`: `random_password` de Terraform (128 caracteres,
  `special = false`), nunca tecleado por una persona.
- Password de RDS: también `random_password` (`special = false` a
  propósito — un caracter como `#` sin encodear rompe silenciosamente el
  parseo de `DATABASE_URL`, exactamente el bug real que ya tuvimos
  migrando a Supabase esta semana).
- Ambos + la `DATABASE_URL`/`DIRECT_URL` completa viven en Secrets
  Manager (`secrets.tf`), y el rol de instancia de App Runner
  (`apprunner_instance`) solo tiene permiso de leer esos 2 secrets
  puntuales, no todo Secrets Manager.

## Permisos IAM de aprovisionamiento — no `IAMFullAccess`

`iam-provisioning-policy.json` es la política que debe usar la
identidad (usuario/rol) que corre `terraform apply` — reemplaza un
`IAMFullAccess`/`AdministratorAccess` genérico por algo acotado a
exactamente lo que este Terraform toca:

- EC2: solo lectura de VPC/subnets + crear/gestionar Security Groups (no
  instancias EC2, no gestión de la VPC en sí).
- RDS, ECR (+ push de imagen), Secrets Manager (acotado a los secrets bajo
  el prefijo `indi-asistencia/*`), App Runner: los servicios concretos que
  este stack crea.
- **IAM: lo mínimo posible, no gestión de IAM en general.** Solo
  crear/gestionar roles cuyo nombre empiece con `indi-asistencia-` (los 2
  roles de servicio que `apprunner.tf` necesita) — nada de crear usuarios,
  grupos, tocar la política de contraseñas de la cuenta, MFA, ni roles
  fuera de ese prefijo. `AttachRolePolicy`/`DetachRolePolicy` además
  restringido a la única policy administrada por AWS que se adjunta
  (`AWSAppRunnerServicePolicyForECRAccess`), y `PassRole` restringido a que
  el servicio destino sea realmente App Runner (`iam:PassedToService`).
- S3 + DynamoDB: acotado a los nombres exactos del bucket/tabla que crea
  `terraform-bootstrap/` (`indi-asistencia-tfstate` /
  `indi-asistencia-tfstate-lock`).

Reemplazar `<ID_DE_CUENTA>` por el ID real de cuenta de AWS antes de crear
esta política. **No se pudo validar contra la gramática real de IAM en
este entorno** (no hay AWS CLI ni credenciales disponibles aquí) — sí se
validó que es JSON válido y que solo usa claves reconocidas por la
gramática de políticas de IAM (`Sid`/`Effect`/`Action`/`Resource`/
`Condition`, nada inventado). Correr `aws accessanalyzer validate-policy
--policy-document file://iam-provisioning-policy.json --policy-type
IDENTITY_POLICY` en cuanto exista la cuenta, antes de confiar en ella para
un apply real.

## Uso

```bash
cd infra/terraform
terraform init -backend=false   # sin backend real todavia - ver terraform-bootstrap/
terraform validate   # solo sintaxis - NO correr plan/apply sin una cuenta real y terraform.tfvars lleno
```

Antes del primer `apply` real, en este orden (detalle completo en
`../AWS_MIGRATION.md`):
1. Aplicar `../terraform-bootstrap/` (bucket S3 + tabla DynamoDB) y
   descomentar/llenar el bloque `backend "s3"` en `versions.tf` con sus
   outputs — el state de este stack va a contener el password de RDS y el
   JWT_SECRET en texto plano, no puede quedarse local.
2. Crear la identidad de IAM que va a correr Terraform con
   `iam-provisioning-policy.json` adjunta (ver sección de arriba).
3. Copiar `terraform.tfvars.example` a `terraform.tfvars` (gitignoreado) y
   llenarlo con los valores reales de la cuenta.
4. Construir y subir la imagen de `backend/Dockerfile` al repo de ECR que
   este mismo `terraform apply` crea (orden: aplicar el ECR primero, subir
   la imagen, luego aplicar App Runner — o aceptar que el primer apply de
   App Runner falle por no encontrar la imagen y reintentar después de
   subirla).

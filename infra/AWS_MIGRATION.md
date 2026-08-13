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

## 9. Runbook de corte regional `us-east-1` → `mx-central-1`

> **No ejecutar por inferencia.** Esta sección prepara un corte futuro. Requiere
> autorización explícita, responsables presentes y valores confirmados en el
> preflight. El ensayo local reproducible está en
> `backend/scripts/migration/` y se ejecuta con `npm run migration:test`.

### Arquitectura y compatibilidad

El origen productivo actual es RDS PostgreSQL en `us-east-1`, consumido por
ECS/Fargate detrás de ALB, WAF y `api.sistemasindi.com`. El destino es el stack
paralelo del workspace Terraform `mexico`: RDS + ECS/Fargate + ALB + WAF + ACM
en `mx-central-1`, expuesto durante la preparación como
`api-mx.sistemasindi.com`. Route 53 y la zona son compartidos entre workspaces.

Terraform declara PostgreSQL **17.6** para RDS. Antes del corte hay que confirmar
en ambos RDS `server_version`, `server_encoding`, `lc_collate`, `lc_ctype`,
`TimeZone` y extensiones instaladas. El schema actual usa UUID
`gen_random_uuid()` (nativo desde PostgreSQL 13), 6 tipos enum, claves foráneas,
índices y constraints; no usa columnas `serial`/`identity` ni secuencias de la
aplicación. Prisma registra 12 migraciones en `_prisma_migrations` a fecha de
este runbook. Repetir estos conteos durante el corte: pueden cambiar después.

La herramienta `pg_dump` debe ser de la misma versión mayor del servidor origen
o una posterior compatible; un `pg_dump` 16 no puede respaldar un servidor 17.
Para el corte real se fija una imagen oficial `postgres:17` por digest
**POR CONFIRMAR DURANTE CORTE REAL**. No usar `latest`. El ensayo local usa
PostgreSQL 16 porque es la versión ya establecida para tests del proyecto; esto
valida el procedimiento, no la compatibilidad exacta de RDS 17.6.

Riesgos a revisar: extensiones no presentes en destino, ownership/roles del
origen, collations diferentes, zona horaria del servidor, grants, objetos fuera
de `public` y cambios de schema posteriores al ensayo. `--no-owner --no-acl`
evita transportar propietarios y grants del origen; los permisos del rol de
destino se asignan por el canal autorizado de RDS.

### Fase 0 — Preconditions

- [ ] Autorización formal y ventana de mantenimiento aprobadas.
- [ ] Responsables de infraestructura, backend y RH disponibles; canal de
      decisión de rollback definido.
- [ ] Release/imagen exacta a desplegar identificada y ya validada.
- [ ] Acceso separado y probado a ambos RDS mediante bastión/SSM, sin mostrar
      URLs ni passwords.
- [ ] PostgreSQL client fijado a versión compatible; espacio local temporal y
      capacidad del RDS destino suficientes.
- [ ] Ubicación autorizada y cifrada para dump; retención y eliminación
      aprobadas. La retención legal queda **POR CONFIRMAR DURANTE CORTE REAL**.
- [ ] Snapshot/backup automático del RDS origen confirmado. No crear ni borrar
      snapshots desde este runbook sin autorización específica.
- [ ] Mecanismo de congelamiento de escrituras acordado. Hoy no existe un modo
      mantenimiento de aplicación: es un riesgo operativo pendiente, no debe
      reemplazarse con doble escritura improvisada.

### Fase 1 — Preflight (solo durante el corte autorizado)

- [ ] Confirmar workspace `mexico`, región `mx-central-1` y outputs correctos,
      sin aplicar Terraform durante la ventana.
- [ ] RDS México disponible, cifrado, versión/collation/timezone/extensiones
      compatibles y sin datos productivos previos.
- [ ] ECS México estable, tasks deseadas en ejecución, ALB targets saludables y
      `/health` correcto en el endpoint paralelo.
- [ ] Certificado ACM válido, WAF asociado, logging disponible, security groups,
      endpoints VPC y Secrets Manager correctos.
- [ ] Confirmar que `admsRouter.use("/iclock", restringirPorIP)` permanece y que
      WAF/`ADMS_IPS_PERMITIDAS` limitan exclusivamente `/iclock/*`; el hardware
      físico continúa como validación externa pendiente.
- [ ] Obtener el registro efectivo `api.sistemasindi.com` y su alias/TTL. En
      Terraform es un registro Route 53 `A` alias (`aws_route53_record.api`) y
      los alias no declaran TTL configurable. Destino ALB actual y México:
      **CONFIRMAR EN PREFLIGHT REAL**.
- [ ] Comparar las 12+ filas efectivas de `_prisma_migrations`; no ejecutar
      `migrate reset`. Si la release incorpora migraciones posteriores al dump,
      definir y ensayar previamente el orden exacto de `migrate deploy`.

### Fase 2 — Congelar escrituras

1. Anunciar inicio de mantenimiento y registrar hora UTC/México.
2. Impedir escrituras humanas, kiosco y ADMS en el origen. Como no existe modo
   mantenimiento, el mecanismo operativo exacto es **POR CONFIRMAR DURANTE
   CORTE REAL** y debe bloquear también `/iclock/*`, no solo el frontend.
3. Confirmar que no quedan requests en vuelo ni jobs que escriban.
4. Registrar conteos/checksums de referencia. No continuar si no puede
   demostrarse el congelamiento: dos orígenes escribibles invalidan el dump.

### Fase 3 — Backup final

Usar variables de entorno introducidas por un mecanismo seguro; nunca colocar
passwords en el comando, historial o logs. Plantilla (valores y digest por
confirmar):

```bash
docker run --rm --network host \
  -e PGPASSFILE=/run/secrets/pgpass \
  -v <pgpass-autorizado>:/run/secrets/pgpass:ro \
  -v <directorio-cifrado>:/backup \
  postgres:17@sha256:<digest-confirmado> \
  pg_dump --dbname='<URL-SIN-PASSWORD-CON-TLS>' --format=custom \
    --no-owner --no-acl --file=/backup/indi-final.dump
```

Calcular SHA-256 del dump, registrar tamaño/versión de `pg_dump` y restringir
permisos del archivo. No imprimir la URL completa. El backup no termina hasta
que `pg_restore --list` pueda leerlo.

### Fase 4 — Restore México

1. Confirmar nuevamente que el destino es el RDS México correcto y está vacío.
2. Restaurar con cliente fijado, `--no-owner --no-acl --exit-on-error`, conexión
   TLS validada y rol autorizado. No sustituir el restore con Prisma.
3. Si hay migraciones de aplicación posteriores al schema respaldado, ejecutar
   `prisma migrate deploy` solo en el orden ensayado y después del restore.
4. Ante cualquier error, detenerse; no aceptar restore parcial ni reutilizar la
   base sin limpiarla por un procedimiento autorizado.

### Fase 5 — Integridad y smoke

- [ ] Conteos source/destination de todas las tablas, incluida
      `_prisma_migrations` y `audit_log`.
- [ ] Checksums lógicos deterministas por PK; campos sensibles se hashean y no
      se imprimen. Orden físico nunca forma parte del checksum.
- [ ] Definiciones y conteos de PK, FK, unique constraints, índices y enums.
- [ ] Secuencias/identities y próximo insert sin colisión; hoy se esperan cero,
      pero comprobar en el schema efectivo.
- [ ] Consulta Prisma real contra destino.
- [ ] Backend apuntando exclusivamente a México: `/health`, login ficticio
      autorizado, trabajadores, asistencia, nómina, roles, terminal y reporte.
- [ ] Logs sin errores DB/TLS, ALB target healthy y latencia básica registrada.
- [ ] Verificar snapshot de `NominaSemanal` y que `AuditLog` llegó completo.

Todo debe ser `MATCH/PASS`. Un mismatch bloquea DNS.

### Fase 6 — DNS cutover

El registro lógico es `aws_route53_record.api`, tipo `A` alias para
`api.sistemasindi.com`. El valor efectivo actual y el ALB México se confirman
en preflight. Preparar cambio revisable y aprobación de dos personas; no usar
un `terraform apply` general para un cambio de DNS de emergencia. Tras cambiar:

- resolver desde más de un resolvedor;
- validar certificado/hostname, `/health`, login, asistencia, nómina y terminal;
- observar ALB/ECS/WAF/logs y confirmar que el tráfico llega a México;
- mantener origen intacto y no aceptar escrituras allí.

### Fase 7 — Observación

Mantener `us-east-1`, el dump final y la evidencia sin modificaciones durante
un periodo aprobado **POR CONFIRMAR DURANTE CORTE REAL**. Vigilar errores,
latencia, salud de tasks/targets, conexiones RDS, WAF, login, marcaciones,
nómina y auditoría. No destruir recursos durante esta fase.

### Fase 8 — Retiro de origen (cambio separado)

Solo después de estabilidad México, autorización nueva, backup conservado,
métricas aceptadas y declaración de que rollback ya no es necesario. Retirar
DNS/servicios/datos en un plan y revisión separados; nunca como consecuencia
automática del cutover.

### Rollback

- **Antes de DNS:** abortar, retirar el congelamiento y continuar en origen.
- **Después de DNS, antes de nuevas escrituras en México:** devolver el alias al
  ALB origen, validar origen y retirar mantenimiento con autorización.
- **Después de nuevas escrituras en México:** alto riesgo. Cambiar DNS de vuelta
  perdería/dividiría datos nuevos. Congelar ambos lados, conservar ambos estados
  y escalar a decisión técnica/RH. Reconciliar asistencia, nómina y auditoría
  requiere un procedimiento específico; no existe ni se autoriza un merge
  automático. La defensa es validar antes del corte y ejecutar rollback temprano.

### TLS, secretos y backups

Runtime ECS obtiene `DATABASE_URL` de Secrets Manager y
`src/utils/prisma.ts` selecciona `rds-global-bundle.pem` para hosts RDS con
`rejectUnauthorized: true`. El CA está incluido en la imagen en
`/app/certs`; una ruta local del operador no sirve dentro de ECS. Para Prisma
CLI/pg tools usar `sslmode=verify-full` contra hostname RDS y CA explícita;
por túnel `localhost`, `verify-ca` evita el mismatch de hostname sin desactivar
la validación de cadena. No usar `sslmode=require` como sustituto.

El dump viaja cifrado por TLS y descansa solo en ubicación autorizada/cifrada.
Registrar acceso, checksum y destrucción segura posterior conforme a una
política de retención aún por aprobar. El state Terraform y Secrets Manager no
son canales para transportar dumps.

### Checklist temporal compacta

**T-24h (o anticipación aprobada):** responsables, autorización, herramientas,
backup/snapshot, capacidad, salud México, DNS/TTL efectivo y congelamiento.

**T-30min:** smoke México, secrets/TLS/WAF, usuarios ficticios, comunicación de
mantenimiento y criterio de abortar.

**T0:** congelar todas las escrituras → drenar → dump final → checksum → restore
→ integridad completa → smoke. DNS solo si todo es PASS.

**T+<duración observada>:** DNS, health, login, asistencia, nómina, terminal,
reportes, logs y auditoría.

**T+<periodo de observación aprobado>:** mantener origen intacto; decidir retiro
en una fase autorizada independiente.

## 10. Ensayo local reproducible

Desde `backend/`, con Docker disponible:

```bash
npm run migration:test:guards
npm run migration:test
```

El script crea PostgreSQL 16 efímeros en `127.0.0.1:55432` y `:55433`, aplica
Prisma y genera datos completamente ficticios (137 trabajadores, cinco roles,
activos/bajas, asistencia, movimientos, nómina, tarifas, terminales y
auditoría). Usa `pg_dump --format=custom --no-owner --no-acl`, restaura con
`pg_restore --exit-on-error`, compara conteos/checksums/schema y arranca el
backend contra el destino para smoke HTTP. Un `trap` elimina dump, contenedores,
volúmenes y red aun ante fallo.

Las guardas aceptan solo `localhost`, `127.0.0.1`,
`postgres-source-test`/`postgres-mexico-test` y bases con nombre explícito de
test. Rechazan RDS, Supabase, el dominio público, IP pública, host o base no
permitidos. Las URLs deben pasarse explícitamente si se sobreescriben; el script
no lee `.env`.

Evidencia local del 2026-08-13 (no extrapolable a downtime productivo): dos
ciclos desde cero finalizaron en PASS. En ambos: seed 1 s, dump <1 s, restore
1 s, verify <1 s, smoke 4 s, total 6 s; 137 trabajadores, 12 migraciones,
33 constraints, 45 índices, 17 etiquetas enum y cero secuencias. Todos los
conteos y checksums coincidieron. La versión exacta de RDS, extensiones,
collation, endpoints/alias DNS y duración productiva quedan para preflight real.

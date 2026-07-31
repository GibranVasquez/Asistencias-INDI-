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

## Certificado SSL de RDS — verificado en vivo, código actualizado (2026-07-30)

`backend/certs/rds-global-bundle.pem` (el bundle combinado público de AWS,
`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`, 108
certificados) verificado en vivo contra la instancia real
(`indi-asistencia-production.cwd2giaksarx.us-east-1.rds.amazonaws.com`):
prueba positiva (CA real, `rejectUnauthorized: true`) conecta y corre una
query real; prueba negativa (CA real pero de otra autoridad, ISRG Root
X1/Let's Encrypt) falla con "self-signed certificate in certificate
chain" — mismo patrón que la prueba negativa que ya se hizo para el CA de
Supabase.

**`src/utils/prisma.ts` ya NO tiene el CA hardcodeado a Supabase** —
bug real encontrado en producción el mismo día: el ECS de producción
apunta su `DATABASE_URL` a RDS desde que se escribió `secrets.tf`, pero
el código seguía validando TLS contra el CA de Supabase, así que TODA
query fallaba (oculto detrás de un 500 genérico porque
`NODE_ENV=production` esconde el mensaje real en `errorHandler.ts`).
Corregido con selección dinámica del CA: `DB_CA_PATH` como override
explícito, o inferido del host en `DATABASE_URL` (`*.rds.amazonaws.com`
→ RDS, cualquier otro caso → Supabase) — así desarrollo local (sigue
contra Supabase, `backend/.env`) y producción (RDS) funcionan sin tocar
el archivo de nuevo. Ver `CLAUDE.md` para el detalle narrativo completo.

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

## WAF para `/iclock/*` (endpoint ADMS) — segunda capa, específica de AWS

`waf.tf`: Web ACL de WAF asociado directamente al servicio de App Runner
(`aws_wafv2_web_acl_association`, `resource_arn = aws_apprunner_service.backend.arn`)
— confirmado que esto es posible sin CloudFront ni cambiar de arquitectura,
para un servicio *público* de App Runner (la limitación de "las reglas de
IP no funcionan" solo aplica a servicios *privados*). Bloquea peticiones a
rutas que empiecen con `/iclock/` cuya IP de origen no esté en
`var.adms_ips_permitidas` (`aws_wafv2_ip_set`).

**Esta NO es la única mitigación** — la primera y principal es de
aplicación (`backend/src/middlewares/restringirPorIP.ts`, misma variable
`ADMS_IPS_PERMITIDAS`), funciona en cualquier plataforma (Railway o AWS,
la decisión sigue sin tomarse) y ya está activa hoy. El WAF es una capa
adicional que solo aplica una vez que exista una cuenta de AWS real y se
elija esa plataforma — ver CLAUDE.md, sección ADMS, para el razonamiento
completo de por qué dos capas.

## Permisos IAM de aprovisionamiento — no `IAMFullAccess`

**Dos políticas separadas** (2026-07-28, reemplaza el archivo único
anterior `iam-provisioning-policy.json`), ambas adjuntas a la misma
identidad (`claude-code-indi`) que corre `terraform apply` — reemplazan
un `IAMFullAccess`/`AdministratorAccess` genérico por algo acotado a
exactamente lo que este Terraform toca. Se dividieron porque AWS impone
un límite duro de **6144 caracteres sin espacios en blanco** por política
administrada por el cliente, y un solo archivo lo excedió durante el
primer `apply` real contra la cuenta (demasiadas idas y vueltas
agregando permisos puntuales que el provider de AWS pedía en cada
`refresh`).

**Criterio de la división — dónde va cada permiso nuevo:**

| Archivo | Contenido | Por qué ahí |
|---|---|---|
| `iam-provisioning-policy-datos.json` | RDS, Secrets Manager, S3 (backend de state), DynamoDB (lock del state), **Route 53 + ACM + WAF (movidos aquí 2026-07-30 por espacio, ver historial abajo)** | Estable — estos recursos ya están definidos y no se espera que crezcan mucho más. Margen amplio (2422/6144 caracteres al 2026-07-30, ~3700 libres). |
| `iam-provisioning-policy-compute.json` | EC2/VPC/Security Groups, ECR (+ push de imagen), ECS + Application Auto Scaling, ELBv2 (ALB), CloudWatch Logs, roles/instance-profiles de IAM (incluido el service-linked role compartido de RDS+ELB+ECS+Application Auto Scaling — es un permiso de IAM, no de esos servicios), bastión EC2/SSM | Todo lo que sigue cambiando activamente. **5716/6144 caracteres al 2026-07-30** — vigilar el conteo antes de agregar algo más; si no alcanza, mover otra categoría estable a `datos` en vez de apretar al límite (ver historial). |

**Regla práctica:** si el permiso nuevo es sobre una instancia RDS, un
secret, el bucket de state, la tabla de lock, o (desde 2026-07-30) Route
53/ACM/WAF → `datos`. Si es sobre red (VPC/EC2/SG), contenedores/cómputo
(ECS/ECR/ALB/CloudWatch Logs), o cualquier rol/instance-profile de IAM →
`compute`. Route 53/ACM/WAF se movieron de `compute` a `datos` no porque
encajen naturalmente en esa categoría (son DNS/certificados/firewall, no
"datos" en sentido estricto), sino porque `compute` se quedó sin margen
real más de una vez al agregar los permisos de ECS/ELBv2/CloudWatch
Logs/service-linked roles — son categorías estables (dominio, certificado
y las reglas del WAF ya existen y no se espera que crezcan) así que
fueron los candidatos más seguros para mover en vez de apretar `compute`
al límite cada vez. Si esto se repite una tercera vez, vale la pena
reconsiderar el criterio de división por completo en vez de seguir
moviendo categorías una por una.

**IMPORTANTE — deben existir 2 objetos de política REALES en la consola
de AWS, simultáneamente, nunca uno solo alternando contenido.**
Encontrado en vivo 2026-07-28: durante varias rondas de "aplica esto en
la consola" solo se creó/actualizó una política de nombre
`indi-provisioning-policy` (sin sufijo — la que ya existía desde antes
de dividir el archivo original) — el archivo `-datos.json` nunca llegó a
existir como una segunda política independiente en AWS, aunque el
repositorio sí tuviera los dos archivos separados desde hace rato.
**Los nombres de política en AWS son inmutables** (no se pueden
renombrar una vez creadas) — por eso la política ya existente se queda
con el nombre `indi-provisioning-policy` a secas (tratarla como la de
"compute" de aquí en adelante, aunque el nombre no lo diga), y la nueva
se crea como `indi-provisioning-policy-datos`. Ambas deben aparecer
attachadas a la vez en IAM → Users → `claude-code-indi` → pestaña
Permissions — si solo aparece una, algo se pegó encima de la otra por
error.

Reemplazar `<ID_DE_CUENTA>` por el ID real de cuenta de AWS antes de
crear estas políticas (ya hecho — ver `CLAUDE.md`, ambas usan
`183537898129`). Verificado contra la cuenta real con el validador de
políticas de la consola de AWS (Access Analyzer) en cada ronda de
cambios — no solo sintaxis JSON.

**Historial de permisos agregados en vivo** (todos surgieron de
`terraform apply`/`plan` reales contra la cuenta, no anticipados de
antemano salvo donde se indique): permisos `Describe*`/`Get*`/`List*`
de solo lectura que el provider de AWS pide al refrescar el estado
completo de VPC, subnets, EC2, instancias, volúmenes, buckets S3 y
tablas DynamoDB; `iam:CreateServiceLinkedRole` para el rol
`AWSServiceRoleForRDS` (primera vez que la cuenta crea una instancia
RDS); permisos de IAM para adjuntar `AmazonSSMManagedInstanceCore` y
pasar roles a `ec2.amazonaws.com` (bastión SSM). Ver `CLAUDE.md` para el
detalle narrativo completo de cada hallazgo.

**2026-07-30 — ronda grande tras el primer `terraform apply` real del
stack ECS/ALB completo:** el archivo `compute` nunca había recibido
permisos de ECS/ELBv2/CloudWatch Logs (se escribió `ecs.tf` sin
actualizar la política en el mismo cambio) — confirmado en vivo con 6
`AccessDenied` reales de una sola corrida: `ecs:CreateCluster`,
`elasticloadbalancing:DescribeLoadBalancers`,
`elasticloadbalancing:DescribeTargetGroups`, `logs:CreateLogGroup`,
`iam:AttachRolePolicy` (el `ArnEquals` seguía condicionado solo a
`AWSAppRunnerServicePolicyForECRAccess`, ya muerto, no a
`AmazonECSTaskExecutionRolePolicy`), e `iam:ListInstanceProfilesForRole`
(necesario para que el provider pueda borrar los roles de App Runner
huérfanos). Se agregaron statements nuevos `ECS`,
`ApplicationAutoScalingParaECS`, `ELBv2ParaALB`,
`CloudWatchLogsParaBackend`; se actualizó el `Condition` de
`IAMAttachSoloPoliticasEspecificas` (App Runner → `AmazonECSTaskExecutionRolePolicy`)
y de `IAMPassRoleSoloParaAppRunnerYBastion` (renombrado
`IAMPassRoleSoloParaECSYBastion`, `PassedToService` App Runner →
`ecs-tasks.amazonaws.com`). El statement `AppRunner` completo (643
caracteres, ya 100% muerto) se eliminó para hacer espacio — sin esa
eliminación el archivo no habría cabido bajo el límite de 6144.

**2026-07-30 — segunda vuelta, tras aplicar lo anterior en la consola:**
el mismo apply avanzó mucho más (creó `ecs_cluster`, `ecs_task_definition`,
`cloudwatch_log_group`, `wafv2_web_acl`, `lb_target_group`, y destruyó
limpio los 3 recursos de App Runner) pero encontró 2 problemas nuevos:
`iam:CreateServiceLinkedRole` para `AWSServiceRoleForElasticLoadBalancing`
(primera vez que la cuenta crea un ALB — mismo patrón que
`AWSServiceRoleForRDS` en la ronda anterior), y `InvalidParameterCombination:
Cannot find version 17.4 for postgres` (no es un permiso — esa minor
version de Postgres no existe en ninguna región; corregido a `17.6` en
`variables.tf`, confirmado real con `aws rds describe-db-engine-versions`).
Se fusionó el nuevo permiso de service-linked role con el de RDS en un
solo statement (`IAMServiceLinkedRoleParaAWS`, `Resource`/`AWSServiceName`
como listas) en vez de agregar uno más separado, y se movieron
`Route53ParaDominio`/`ACMParaCertificadoBackend` a `datos.json` sin
cambios (ver tabla arriba) para no volver a apretar `compute` al límite.
**2026-07-30 — tercera vuelta:** con lo anterior aplicado en la consola
(ambas políticas), `aws_db_instance.postgres` se creó sin ningún
problema de permisos (7m18s, sin necesitar KMS explícito — la
preocupación de la ronda anterior no se materializó, la key
administrada por AWS para `storage_encrypted` no exige permiso propio
en este caso). Un solo permiso nuevo salió: `ec2:DescribeAccountAttributes`,
que pide `aws_lb.this` internamente al crear el ALB (verifica límites de
cuenta antes de crear) — agregado a `EC2RedYSeguridad` en `compute.json`
(5716/6144).

**2026-07-30 — cuarta vuelta:** `aws_lb.this` y `aws_route53_record.api`
se crearon bien (el ALB ya responde, `api.sistemasindi.com` ya resuelve
a él). 2 permisos nuevos, ambos en `ELBv2ParaALB`:
`elasticloadbalancing:DescribeListenerAttributes` (el provider la pide
tras crear cada listener, para leer sus atributos — al fallar dejó
`aws_lb_listener.http`/`.https` en estado `tainted` aunque ya existían
bien en AWS; se corrigió con `terraform untaint` en los dos, sin
destruir/recrear nada, mismo patrón que los secrets/ip_set de rondas
anteriores) y `elasticloadbalancing:SetWebACL` (WAFv2 `AssociateWebACL`
contra un ALB internamente delega en la API de ELBv2 para fijar el Web
ACL, así que el permiso real que hace falta es de `elasticloadbalancing:*`,
no de `wafv2:*`, aunque el recurso de Terraform sea
`aws_wafv2_web_acl_association`). `compute.json` quedó en 5799/6144.

**2026-07-30 — quinta vuelta:** `aws_wafv2_web_acl_association.adms` se
creó bien (4s, el ALB ya está protegido por el Web ACL). Solo faltó
`aws_ecs_service.backend`: `InvalidParameterException: Unable to assume
the service linked role` — primera vez que la cuenta crea un servicio
ECS, necesita `AWSServiceRoleForECS` (mismo patrón exacto que RDS y
ELB). Se agregó como tercer ARN/`AWSServiceName` al statement ya
fusionado `IAMServiceLinkedRoleParaAWS` en vez de crear uno nuevo.
`compute.json` quedó en 5908/6144. El intento de `CreateService` falló
limpio (no quedó nada en el state para `untaint`).

**2026-07-30 — antes de la sexta vuelta, revisión preventiva (no un
error real de un apply):** con solo 236 caracteres libres en
`compute.json` y sabiendo que `aws_appautoscaling_target.ecs` seguía
pendiente (bloqueado en cascada por el ECS service, no probado todavía),
se anticipó que Application Auto Scaling también iba a pedir su propio
service-linked role la primera vez
(`AWSServiceRoleForApplicationAutoScaling_ECSService`,
`ecs.application-autoscaling.amazonaws.com`) — mismo patrón exacto que
RDS/ELB/ECS. Agregarlo como 4to elemento al statement fusionado
necesitaba 187 caracteres más, dejando solo 49 libres — no cómodo. Se
movió `WAFParaEndpointADMS` completo (378 caracteres, sin cambios) a
`datos.json` en la misma pasada en vez de apretar `compute` otra vez.
Resultado: `compute.json` 5716/6144, `datos.json` 2422/6144. Esta vez el
permiso se agregó ANTES de un apply real (no confirmado en vivo
todavía) porque el patrón ya era muy predecible tras 3 repeticiones
idénticas (RDS, ELB, ECS) — sí calza con "no anticipar de más", ya que
es el mismo hallazgo empírico repitiéndose, no una suposición nueva.

**2026-07-30 — VPC Endpoints (Secrets Manager/ECR/CloudWatch Logs/S3),
tras descubrir que las tasks de ECS en subredes privadas no podían
llegar a esos endpoints públicos sin NAT Gateway ni VPC Endpoints (ver
`vpc_endpoints.tf` para el detalle completo).** Se agregaron 5 acciones
a `EC2RedYSeguridad`: `CreateVpcEndpoint`, `DeleteVpcEndpoints`,
`DescribeVpcEndpoints`, `DescribeVpcEndpointServices`,
`ModifyVpcEndpoint` (confirmadas necesarias, `ModifyVpcEndpointServicePermissions`
descartado explícitamente — ese es para publicar un servicio PrivateLink
propio, no para consumir los que AWS ya publica). **Incidente real de
esta ronda: el archivo local y la política activa en la consola se
desincronizaron** — el apply falló 2 veces con `UnauthorizedOperation`
en `ec2:CreateVpcEndpoint` a pesar de que el permiso ya estaba en el
archivo; se investigó (sin necesidad) permissions boundary y SCP antes
de que el Simulador de políticas de IAM confirmara "denegación implícita,
ninguna declaración coincide" — la causa real era simplemente que la
consola nunca se había vuelto a actualizar con ese cambio específico.
Corregido con un repegado completo del archivo. **Regla adoptada desde
este incidente:** toda edición a estos 2 archivos debe decir
explícitamente "esto necesita que vuelvas a pegar el archivo completo
en la consola" — nunca asumir que un edit local ya está reflejado en
AWS. Tras el repegado, salió un permiso más, genuinamente nuevo (no el
mismo error repetido): `ec2:DescribePrefixLists` (el provider lo pide
al leer los endpoints después de crearlos) — agregado, los 5
`aws_vpc_endpoint.*` quedaron `tainted` por ese fallo de lectura
posterior a la creación real, resuelto con `terraform untaint` en los 5
sin destruir/recrear nada. `compute.json` quedó en 6000/6144.

**2026-07-30 — análisis preventivo antes del siguiente repegado (a
pedido explícito del usuario, dado el margen crítico):** se confirmó
por diff exacto (`comm` entre recursos declarados en los `.tf` y
`terraform state list`, no revisión visual) que el 100% del stack
principal ya existe en el state — no queda ningún recurso nuevo por
crear, incluyendo WAF association y el registro DNS (ambos ya
aplicados en rondas anteriores). El único bloqueo real es que
`ec2:DescribePrefixLists` frena el refresh de TODO el plan (no solo de
los VPC endpoints), porque Terraform refresca el state completo antes
de poder confirmar "sin cambios". Se agregó también
`ec2:DescribeManagedPrefixLists` de forma preventiva (confirmado via
búsqueda que la documentación oficial de AWS la lista consistentemente
junto a `DescribePrefixLists` en ejemplos de política de VPC - la
acción más nueva/recomendada para lo mismo, el provider de Terraform
puede llamar cualquiera de las dos según version). Para hacer espacio
sin apretar el margen a cero, se movió `IAMInstanceProfileBastion`
(310 caracteres, sin cambios) a `datos.json` - candidato elegido por
ser el más estable de los que quedaban en `compute` (el bastión está
cerrado hace mucho, no se espera que este permiso crezca). Resultado:
`compute.json` 5722/6144, `datos.json` 2733/6144.

**2026-07-30 — sexta y séptima vuelta: la causa real de
`aws_ecs_service.backend` no era falta de permisos.** Con
`IAMServiceLinkedRoleParaAWS` ya actualizado en la consola, el mismo
error (`Unable to assume the service linked role`) se repitió 2 veces
más, idéntico, con varios minutos de diferencia entre intentos — eso
descartó lag de propagación de IAM. La causa real, confirmada contra un
issue conocido del propio `terraform-provider-aws`
([#11417](https://github.com/hashicorp/terraform-provider-aws/issues/11417)):
`AWSServiceRoleForECS` se crea de forma asíncrona la primera vez que la
cuenta usa ECS, y `ecs:CreateService` puede llegar antes de que esa
creación termine — una condición de carrera, no un permiso faltante
(el permiso ya estaba bien). Se resolvió corriendo
`aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com`
manualmente antes del apply, forzando la creación síncrona — funcionó,
`aws_ecs_service.backend` se creó en 2s en el siguiente intento. Se hizo
lo mismo preventivamente para
`ecs.application-autoscaling.amazonaws.com`
(`AWSServiceRoleForApplicationAutoScaling_ECSService`) para no repetir
la misma carrera con `aws_appautoscaling_target.ecs`. Con eso resuelto,
salió un permiso real distinto: `application-autoscaling:TagResource`
(más `UntagResource`/`ListTagsForResource` agregados junto, mismo patrón
de tags automáticos vía el `default_tags` del provider en `main.tf` que
ya se repitió con ECR/ECS/WAF/CloudWatch Logs) — no anticipado antes
porque se asumió que `aws_appautoscaling_target`/`_policy` no soportaban
tags; sí los soportan en esta versión del provider. `compute.json`
quedó en 5840/6144. Ver `CLAUDE.md`, sección de Despliegue, para el
estado exacto de cada intento.

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
2. Crear la identidad de IAM que va a correr Terraform con AMBAS
   políticas adjuntas (`iam-provisioning-policy-datos.json` +
   `iam-provisioning-policy-compute.json`, ver sección de arriba).
3. Copiar `terraform.tfvars.example` a `terraform.tfvars` (gitignoreado) y
   llenarlo con los valores reales de la cuenta.
4. Construir y subir la imagen de `backend/Dockerfile` al repo de ECR que
   este mismo `terraform apply` crea (orden: aplicar el ECR primero, subir
   la imagen, luego aplicar App Runner — o aceptar que el primer apply de
   App Runner falle por no encontrar la imagen y reintentar después de
   subirla).

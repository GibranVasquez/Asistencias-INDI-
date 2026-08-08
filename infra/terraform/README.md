# Terraform — AWS (ECS/Fargate + ALB + RDS)

Este directorio contiene el stack principal de AWS del backend. La
infraestructura ya fue aplicada: `us-east-1` continúa sirviendo producción y
el workspace de Terraform `mexico` mantiene un stack paralelo en
`mx-central-1` con nombres terminados en `-mx` mientras se completa la
migración regional.

La arquitectura actual es:

```text
Route 53 + ACM
       |
       v
      WAF
       |
       v
      ALB
       |
       v
ECS/Fargate ----> Secrets Manager
       |
       v
 PostgreSQL en RDS
```

Las tasks se ejecutan en subredes privadas sin NAT. Los endpoints definidos
en `vpc_endpoints.tf` permiten acceder a Secrets Manager, ECR, CloudWatch Logs
y S3. App Runner aparece únicamente en comentarios históricos de la migración;
no forma parte de la arquitectura actual.

## Estado regional

- `us-east-1`: producción funcional y origen de la migración.
- `mx-central-1`: stack paralelo ya desplegado mediante el workspace
  `mexico`, con sufijo `-mx` y subdominio temporal independiente.
- Pendiente antes del corte definitivo: migración de datos, checksums, cambio
  DNS, validación y limpieza controlada de `us-east-1`.

La zona de Route 53 es compartida entre workspaces. Cada región usa sus
propios recursos de cómputo y datos. Consultar
[`../AWS_MIGRATION.md`](../AWS_MIGRATION.md) antes de cualquier operación.

## Recursos declarados

El stack define exclusivamente los recursos presentes en los archivos `.tf`:

- ECS/Fargate, auto scaling, ALB y listeners HTTP/HTTPS (`ecs.tf`).
- PostgreSQL en RDS y grupos de seguridad (`rds.tf`).
- ECR (`ecr.tf`).
- Route 53 y ACM (`dns.tf`).
- WAF para proteger `/iclock/*` y logging en CloudWatch (`waf.tf`).
- Secrets Manager para JWT, contraseña y URL de base de datos (`secrets.tf`).
- VPC Endpoints para las tasks privadas (`vpc_endpoints.tf`).
- Comprobación de drift de políticas IAM (`iam_drift_check.tf`).

La red base y el bastión SSM viven en `../terraform-network/`. El backend
remoto de estado se creó desde `../terraform-bootstrap/`.

## Decisión: sin RDS Proxy

RDS Proxy no se incluye. ECS mantiene un número pequeño de procesos Node
persistentes y cada uno utiliza el pool de `@prisma/adapter-pg`; para la escala
actual no se justifica el costo ni la complejidad adicional. Reconsiderar si
se incorporan cargas serverless, aumenta significativamente el número de
tasks o se habilita Multi-AZ con nuevos requisitos de failover.

## TLS y secretos

- `JWT_SECRET` y la contraseña de RDS se generan con `random_password`.
- La URL de conexión se almacena en Secrets Manager y no incluye
  `sslmode=require`; el backend configura TLS y el CA explícitamente en
  `backend/src/utils/prisma.ts`.
- El state remoto contiene valores sensibles y debe permanecer en el backend
  S3 configurado en `versions.tf`, nunca publicarse ni copiarse al repositorio.
- RDS no es público. El acceso administrativo se realiza mediante el bastión
  SSM documentado en `../terraform-network/README.md`.

## WAF y ADMS

`waf.tf` asocia el Web ACL al ALB. La regla bloquea solicitudes a
`/iclock/*` fuera de la lista de IP permitidas; el resto de la API conserva la
acción predeterminada. Esta es una segunda capa: el backend aplica además
`ADMS_IPS_PERMITIDAS` con comportamiento fail-closed en producción.

El logging del WAF a CloudWatch está declarado mediante
`aws_wafv2_web_acl_logging_configuration.adms` y su log group tiene retención
de 30 días.

## IAM y separación de responsabilidades

Las políticas de aprovisionamiento se mantienen en dos archivos por el límite
de tamaño de AWS:

- `iam-provisioning-policy-compute.json`: cómputo, red operativa, ECS, ECR,
  ALB y permisos de roles de servicio estrictamente necesarios.
- `iam-provisioning-policy-datos.json`: RDS, Secrets Manager, state remoto,
  Route 53, ACM, WAF y permisos estables relacionados.

La identidad automatizada `claude-code-indi` ejecuta Terraform con permisos
acotados. No puede ni debe modificar sus propias políticas. Cualquier ajuste
de esas políticas corresponde exclusivamente a la identidad humana
administrativa `gibran-admin`.

`iam_drift_check.tf` compara el JSON local con las versiones activas en AWS y
detiene plan/apply si encuentra diferencias. Una edición local de las
políticas no cambia AWS por sí sola; el administrador debe aplicar la versión
completa por el canal correspondiente.

## Uso seguro

```bash
cd infra/terraform
terraform init
terraform workspace list
terraform validate
```

Antes de `plan` o `apply`:

1. Confirmar el workspace y la región objetivos.
2. Revisar `terraform.tfvars` local y los outputs de la red correspondiente.
3. Confirmar que el drift-check IAM está limpio.
4. Revisar el plan completo y la checklist de `AWS_MIGRATION.md`.

No ejecutar `terraform apply` desde instrucciones genéricas ni asumir que el
workspace seleccionado es el correcto. Producción sigue en `us-east-1` hasta
que la migración de datos, el corte DNS y la validación hayan terminado.

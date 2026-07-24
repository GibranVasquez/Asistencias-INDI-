# Bootstrap del backend remoto de Terraform

**Este es el primer recurso real que se aplica, antes que cualquier otra
cosa de `infra/terraform/`.** Crea el bucket S3 (versionado, cifrado
SSE-S3, sin acceso público) y la tabla DynamoDB de locking que el stack
principal (RDS + App Runner) va a usar como backend remoto.

## Por qué existe separado de `infra/terraform/`

Problema del huevo y la gallina: el stack principal no puede usar como
backend remoto un bucket que todavía no existe. Este bootstrap se aplica
una sola vez, con state **local** — y ese state local sí es seguro de
dejar en disco: a diferencia del stack principal (que va a tener el
password de RDS y el JWT_SECRET en texto plano en su state), este solo
describe un bucket y una tabla vacíos, sin ningún secreto.

## Cuándo correr esto

Una sola vez, la primera vez que exista la cuenta de AWS — antes de tocar
`infra/terraform/` para nada más que `validate`. Ver `../AWS_MIGRATION.md`,
paso 0.

```bash
cd infra/terraform-bootstrap
terraform init
terraform apply
terraform output   # copiar bucket_name y dynamodb_table_name
```

Con esos dos valores, descomentar y llenar el bloque `backend "s3"` en
`infra/terraform/versions.tf`, y ahí sí correr `terraform init` en
`infra/terraform/` (Terraform va a preguntar si migrar el state local a
S3 — decir que sí, aunque a esa altura el state local del stack principal
todavía esté vacío de todos modos si es la primera vez).

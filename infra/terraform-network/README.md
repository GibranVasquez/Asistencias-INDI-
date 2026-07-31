# Terraform — Red (VPC dedicada)

**Por qué existe este stack:** la cuenta de AWS real (verificado
2026-07-27 con `aws ec2 describe-vpcs`/`describe-subnets`, perfil
`indi-produccion`) solo tiene la VPC "default" que AWS crea
automáticamente — y sus 6 subredes son **todas públicas**
(`MapPublicIpOnLaunch=true` en las 6, el patrón estándar de una VPC
default recién creada). `infra/terraform/variables.tf` (el stack
principal) requiere subredes **privadas** para el DB subnet group de RDS
y el VPC Connector de App Runner — la VPC default no sirve tal cual.

Este stack crea una VPC nueva y dedicada, con el mismo patrón de dos
fases que `../terraform-bootstrap/`: se aplica primero, y sus outputs
(`vpc_id`, `private_subnet_ids`) se copian a mano al `terraform.tfvars`
de `../terraform/`.

## Qué crea

- 1 VPC (`10.0.0.0/16` por default).
- 2 subredes privadas (una por AZ, 2 AZs) — para RDS y el VPC Connector
  de App Runner.
- 1 route table privada (sin rutas explícitas — solo la ruta "local"
  implícita al CIDR de la propia VPC) + asociaciones.
- 1 subred pública + Internet Gateway + route table pública — solo para
  el bastión SSM (ver abajo). Es el único tráfico de internet real en
  todo este stack.
- 1 instancia EC2 (`t4g.nano`, Amazon Linux 2023 arm64) — el bastión SSM.

## Decisión (revisada 2026-07-27): SIN Internet Gateway, SIN NAT Gateway

La primera versión de este stack incluía un NAT Gateway (para que las
subredes privadas tuvieran salida a internet) — se quitó por completo
tras investigar si de verdad hacía falta, antes de gastar ~$32-33/mes
(solo por estar encendido, sin contar procesamiento de datos — casi todo
el presupuesto de $30/mes configurado en AWS Budgets) en algo que nadie
usa:

- **RDS** es un servicio administrado — no necesita salida propia a
  internet para sus funciones (backups, parches, monitoreo: todo vía el
  control plane de RDS, no la red de la instancia).
- **App Runner con VPC Connector** sí enruta *todo* su tráfico saliente
  por la VPC una vez conectado (confirmado con la documentación de AWS:
  *"Services will not have access to the public internet (including AWS
  APIs) unless allowed by a route to a NAT Gateway"*) — pero
  `runtime_environment_secrets` (`DATABASE_URL`/`JWT_SECRET`, ver
  `../terraform/apprunner.tf`) se resuelve por el **control plane** de
  App Runner, fuera del contenedor — confirmado con la documentación de
  AWS (*"completely isolated from your App Runner application code"*) y
  con un grep real sobre `backend/src/` + las dependencias de
  `package.json`: el código de este backend no tiene ningún SDK de AWS
  ni ningún cliente HTTP saliente — su única conexión de red en tiempo
  de ejecución es Postgres (RDS), vía Prisma.
- **Conclusión:** el único tráfico saliente real del contenedor es hacia
  RDS, que vive dentro de esta misma VPC. Ni el NAT Gateway ni un VPC
  Endpoint de Secrets Manager (la alternativa más barata que se evaluó
  como reemplazo) tienen trabajo real que hacer — no es que uno sea más
  barato que el otro, es que ninguno hace falta.

**Reconsiderar esto** si el backend alguna vez necesita llamar a algo
fuera de la VPC en tiempo de ejecución (una API externa, un SDK de AWS
desde el propio código de la app, etc.) — en ese caso, preferir un VPC
Endpoint específico para ese servicio de AWS antes que un NAT Gateway
genérico, si el servicio en cuestión lo soporta.

## Bastión SSM — para poder migrar el schema desde una laptop

**Problema real:** sin IGW ni NAT (ver decisión de arriba), no hay ningún
camino de red entre una laptop fuera de AWS y RDS — rompe el flujo ya
documentado de correr `prisma migrate deploy` desde una máquina de
desarrollo (`../AWS_MIGRATION.md`, paso 5). Este bastión existe
únicamente para resolver eso — RDS y App Runner nunca lo usan ni saben
que existe.

**Acceso exclusivamente por AWS Systems Manager Session Manager,
autenticado por IAM, no por red:**
- El Security Group del bastión no tiene **ninguna** regla de ingreso —
  ni siquiera SSH. Session Manager funciona con conexiones *salientes*
  del agente hacia el servicio de SSM, nunca necesita un puerto abierto
  hacia adentro.
- El rol de instancia solo tiene adjunta la policy administrada de AWS
  `AmazonSSMManagedInstanceCore` — nada más.
- Quien quiera conectarse necesita permiso IAM de `ssm:StartSession`
  contra esta instancia (no está en ninguna de las 2 políticas de
  aprovisionamiento en `../terraform/` — esas son para *aprovisionar*
  infraestructura, no para *usarla* día a día; el usuario/rol que va a
  correr migraciones necesita ese permiso aparte).

### Patrón de uso: apagado salvo cuando se necesita

Por default, `terraform apply` deja la instancia **corriendo** (AWS no
tiene forma de crearla ya "detenida" desde cero) — apágala manualmente
la primera vez después del apply inicial. De ahí en adelante, el patrón
es: prender → migrar → apagar.

**Verificado, no asumido:** parar (`stop`) una instancia EC2 conserva su
interfaz de red (ENI) y las asociaciones de Security Group intactas —
parar NO desasocia el SG. La regla de ingreso de RDS referencia el **ID
del Security Group del bastión** (`var.bastion_security_group_id`), no
una IP ni la instancia misma, así que sigue siendo válida sin ningún
ajuste esté la instancia corriendo, parada, o recién reiniciada. La IP
pública del bastión sí cambia en cada reinicio (no es una Elastic IP) —
irrelevante para el acceso, porque Session Manager se dirige al
`instance-id` vía la API de SSM, nunca se conecta directo a esa IP.

```bash
# Antes de una migración: prender el bastión
aws ec2 start-instances \
  --profile indi-produccion \
  --instance-ids "$(terraform -chdir=infra/terraform-network output -raw bastion_instance_id)"

# Esperar a que este "running" antes de abrir el tunel (unos 20-30s)
aws ec2 wait instance-running \
  --profile indi-produccion \
  --instance-ids "$(terraform -chdir=infra/terraform-network output -raw bastion_instance_id)"

# ... abrir el tunel de SSM + correr `prisma migrate deploy` (ver abajo) ...

# Despues de la migracion: apagarlo
aws ec2 stop-instances \
  --profile indi-produccion \
  --instance-ids "$(terraform -chdir=infra/terraform-network output -raw bastion_instance_id)"
```

Mientras está detenido, el único costo que sigue corriendo es el
almacenamiento EBS (~$0.64/mes) — el cómputo (~$3.07/mes) y la IP
pública (~$3.65/mes) solo se cobran mientras la instancia está
`running`.

### Prerrequisito local (una sola vez)

El plugin de Session Manager para AWS CLI (no viene incluido con el CLI
base):

```bash
# macOS
brew install --cask session-manager-plugin

# Linux (ver la guía oficial de AWS para el paquete de tu distro):
# https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
```

### Comando exacto para abrir el túnel

```bash
aws ssm start-session \
  --profile indi-produccion \
  --target "$(terraform -chdir=infra/terraform-network output -raw bastion_instance_id)" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<ENDPOINT_DE_RDS>"],"portNumber":["5432"],"localPortNumber":["5432"]}'
```

Reemplaza `<ENDPOINT_DE_RDS>` por el endpoint real (`terraform -chdir=infra/terraform output aws_db_instance.postgres.address` o el valor
correspondiente en `../terraform/outputs.tf`). Deja esta terminal abierta
— el túnel vive mientras el comando siga corriendo.

En **otra** terminal, mientras el túnel esté abierto, `localhost:5432`
es RDS:

```bash
cd backend
DATABASE_URL="postgresql://<usuario>:<password>@localhost:5432/<db_name>?sslmode=require" \
  npx prisma migrate deploy
```

(Usuario/password/nombre de base salen de Secrets Manager y de
`var.db_name` — ver `../terraform/outputs.tf` y `../terraform/secrets.tf`
para dónde queda guardado el password real generado por
`random_password`.)

## Costo mensual estimado del bastión (us-east-1, verificado no asumido)

| Concepto | Costo |
|---|---|
| Cómputo `t4g.nano` (`$0.0042`/hora × 730h) | ~$3.07/mes |
| IP pública (cargo de AWS desde feb-2024, `$0.005`/hora × 730h — aplica a cualquier IPv4 pública, incluida la auto-asignada de una subred pública) | ~$3.65/mes |
| Almacenamiento EBS gp3 (8 GB × ~$0.08/GB-mes) | ~$0.64/mes |
| **Total** | **~$7.36/mes** |

Cabe cómodo dentro del presupuesto de $30/mes en AWS Budgets — deja
~$22/mes para el resto de la infraestructura (RDS, App Runner, etc.).
Sin cargo por transferencia de datos relevante: el uso es esporádico
(solo cuando alguien corre una migración), no tráfico constante.

## State: local, a propósito

Igual que `../terraform-bootstrap/` — este state no contiene ningún
secreto (solo IDs de VPC/subnet/etc.), así que no aplica la misma razón
que obliga a `../terraform/` a usar un backend remoto (ese sí guarda el
password de RDS y el JWT_SECRET en claro).

## Uso

```bash
cd infra/terraform-network
cp terraform.tfvars.example terraform.tfvars   # llenar aws_region
terraform init
terraform plan    # revisar antes de aplicar
terraform apply
terraform output  # copiar vpc_id, private_subnet_ids y bastion_security_group_id a ../terraform/terraform.tfvars
```

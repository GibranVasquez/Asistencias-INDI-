# VPC dedicada para este proyecto — la cuenta solo tenía la VPC "default"
# de AWS, y sus 6 subredes son TODAS públicas (MapPublicIpOnLaunch=true en
# las 6 — el patrón estándar de una VPC default recién creada, confirmado
# con `aws ec2 describe-subnets` 2026-07-27). No sirven para lo que
# infra/terraform/variables.tf pide (subredes privadas para el DB subnet
# group de RDS y el VPC Connector de App Runner).
#
# Este stack se aplica ANTES que infra/terraform/ (mismo patrón de dos
# fases que ../terraform-bootstrap/: un stack chico y fundacional primero,
# cuyos outputs alimentan las variables del stack principal) — ver
# ../AWS_MIGRATION.md.
#
# State: LOCAL a propósito, igual que terraform-bootstrap/ — no contiene
# ningún secreto (solo IDs de VPC/subnet/etc.), así que no aplica la misma
# razón que obliga a infra/terraform/ a usar un backend remoto (ese sí
# guarda el password de RDS y el JWT_SECRET en claro).
#
# Decisión (revisada 2026-07-27): SIN Internet Gateway, SIN NAT Gateway.
# Investigado antes de asumir que hacía falta un NAT (~$32-33/mes solo por
# estar encendido, más procesamiento de datos — casi todo el presupuesto
# de $30/mes en AWS Budgets):
#   - RDS es un servicio administrado; no necesita salida propia a
#     internet para sus funciones (backups, parches, monitoreo — todo vía
#     el control plane de RDS, no la red de la instancia).
#   - App Runner con VPC Connector SÍ enruta TODO su tráfico saliente por
#     la VPC una vez conectado (confirmado con la documentación de AWS:
#     "Services will not have access to the public internet (including
#     AWS APIs) unless allowed by a route to a NAT Gateway") — pero
#     `runtime_environment_secrets` (DATABASE_URL/JWT_SECRET) se resuelve
#     por el control plane de App Runner, FUERA del contenedor — el
#     código de este backend nunca llama a Secrets Manager por sí mismo
#     (confirmado con grep sobre backend/src/ y las dependencias reales
#     de package.json: ningún SDK de AWS, ningún cliente HTTP saliente,
#     solo Prisma hacia Postgres).
#   - Conclusión: el único tráfico saliente real del contenedor es la
#     conexión a RDS, que vive DENTRO de esta misma VPC. Ni el NAT Gateway
#     ni un VPC Endpoint de Secrets Manager (la alternativa más barata que
#     se evaluó) tienen trabajo real que hacer aquí.
# Reconsiderar esto si el backend alguna vez necesita llamar a algo fuera
# de la VPC en tiempo de ejecución (una API externa, un SDK de AWS desde
# el propio código de la app, etc.) — en ese caso, preferir un VPC
# Endpoint específico para ese servicio de AWS antes que un NAT Gateway
# genérico, si el servicio en cuestión soporta VPC Endpoints.
#
# Problema real encontrado 2026-07-27 (después de quitar el NAT): sin IGW
# ni NAT, no hay NINGÚN camino de red entre una laptop fuera de AWS y RDS
# — rompe el flujo ya documentado de correr `prisma migrate deploy` desde
# una máquina de desarrollo (ver ../AWS_MIGRATION.md, paso 5). Se agrega
# un bastión mínimo para resolver esto — ver el bloque de recursos
# "Bastión SSM" más abajo, y el README para el comando exacto de túnel.

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "disponibles" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.disponibles.names, 0, 2)
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

# Subredes privadas únicamente — sin Internet Gateway ni NAT Gateway (ver
# nota de decisión arriba). /20 dentro del /16 de la VPC.
resource "aws_subnet" "privadas" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.this.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)

  tags = {
    Name = "${var.project_name}-${var.environment}-privada-${local.azs[count.index]}"
  }
}

# Sin ninguna ruta explícita a propósito: sin NAT/IGW, lo único que estas
# subredes necesitan es la ruta "local" que AWS agrega automáticamente
# para el CIDR de la propia VPC (RDS y el VPC Connector de App Runner
# solo necesitan alcanzarse entre sí, dentro de la VPC). Se modela como
# recurso explícito (en vez de depender de la route table "main"
# implícita) para poder taggearla y dejar espacio a rutas futuras (ej. un
# VPC Endpoint que sí las necesite).
resource "aws_route_table" "privada" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.project_name}-${var.environment}-privada"
  }
}

resource "aws_route_table_association" "privadas" {
  count          = length(aws_subnet.privadas)
  subnet_id      = aws_subnet.privadas[count.index].id
  route_table_id = aws_route_table.privada.id
}

# ---------------------------------------------------------------------
# Bastión SSM — único componente con salida/entrada real de internet en
# todo este stack. Existe solo para poder correr `prisma migrate deploy`
# desde una máquina de desarrollo (ver nota de decisión arriba) — no para
# que la app o RDS lo usen en absoluto.
#
# Acceso EXCLUSIVAMENTE vía AWS Systems Manager Session Manager
# (autenticado por IAM, no por red): el Security Group no tiene NINGUNA
# regla de ingreso (ni siquiera SSH) — Session Manager funciona por
# conexiones salientes del propio agente hacia el servicio de SSM, nunca
# necesita un puerto abierto hacia adentro. Ver README para el comando
# exacto de port-forwarding hacia RDS.
# ---------------------------------------------------------------------

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

resource "aws_subnet" "publica_bastion" {
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[0]
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, 8)
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-publica-bastion"
  }
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-publica"
  }
}

resource "aws_route_table_association" "publica_bastion" {
  subnet_id      = aws_subnet.publica_bastion.id
  route_table_id = aws_route_table.publica.id
}

# Segunda subred publica, en la otra AZ - necesaria para el ALB de ECS
# clasico (2026-07-28, tras descartar ECS Express Mode y App Runner): un
# ALB exige minimo 2 subredes en 2 AZs distintas, y la unica subred
# publica que existia (publica_bastion) es solo 1, pensada
# especificamente para el bastion. Recurso NUEVO en vez de convertir
# publica_bastion en una lista con count=2, para no forzar destroy+
# recreate del bastion ya aplicado (cambiar el address de un recurso
# fuerza reemplazo, y el bastion ya esta vivo con una instancia real).
resource "aws_subnet" "publica_alb" {
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[1]
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, 9)
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-publica-alb-${local.azs[1]}"
  }
}

resource "aws_route_table_association" "publica_alb" {
  subnet_id      = aws_subnet.publica_alb.id
  route_table_id = aws_route_table.publica.id
}

# Sin ingress en absoluto — ver nota de acceso arriba. Egress abierto: el
# agente de SSM necesita alcanzar los endpoints de Systems Manager sobre
# HTTPS.
resource "aws_security_group" "bastion" {
  name        = "${var.project_name}-${var.environment}-bastion"
  description = "Bastion SSM - sin ingreso desde internet, acceso solo via AWS Systems Manager Session Manager"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "Salida abierta - necesaria para que el agente de SSM alcance los endpoints de Systems Manager"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-bastion-sg"
  }
}

# Rol/perfil de instancia - AmazonSSMManagedInstanceCore (managed policy de
# AWS) es lo único que necesita: permite que el agente de SSM ya instalado
# en la AMI se registre con Systems Manager y acepte sesiones.
resource "aws_iam_role" "bastion_ssm" {
  name = "${var.project_name}-${var.environment}-bastion-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  role       = aws_iam_role.bastion_ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  name = "${var.project_name}-${var.environment}-bastion"
  role = aws_iam_role.bastion_ssm.name
}

# Amazon Linux 2023 ESTANDAR (no "minimal"), arquitectura arm64 (Graviton,
# coincide con t4g.nano). El filtro "al2023-ami-2*-kernel-*-arm64" es
# deliberado: un filtro mas laxo como "al2023-ami-*-kernel-*-arm64"
# tambien hace match con la variante "al2023-ami-minimal-...", y
# most_recent podia terminar resolviendo esa - confirmado en vivo
# 2026-07-27 (el primer intento SI resolvio la minimal por error). La
# variante minimal NO trae el agente de SSM preinstalado (confirmado con
# la documentacion de AWS) - por eso el filtro exige que el caracter
# despues de "ami-" sea un digito (el inicio del numero de version,
# 2023.x), lo cual "minimal" nunca cumple. La variante estandar SI trae
# el agente de SSM preinstalado - pero de todos modos se agrega un
# user_data (abajo) que lo instala/habilita si por lo que sea no
# estuviera, para no depender de que este filtro siga siendo correcto
# para siempre.
data "aws_ami" "al2023_arm64" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2*-kernel-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Red de seguridad, no la garantia principal (esa es el filtro de AMI de
# arriba, ya corregido para evitar la variante "minimal"): instala y
# habilita el agente de SSM si por lo que sea no viniera ya activo. Si ya
# esta instalado y corriendo (el caso esperado con el AMI estandar), esto
# es un no-op inofensivo.
locals {
  bastion_user_data = <<-EOF
    #!/bin/bash
    dnf install -y amazon-ssm-agent
    systemctl enable --now amazon-ssm-agent
  EOF
}

resource "aws_instance" "bastion" {
  ami = data.aws_ami.al2023_arm64.id
  # t4g.nano (mas barato) fue rechazado en vivo por AWS: esta cuenta -
  # nueva, primer recurso real aplicado - solo permite tipos elegibles
  # para Free Tier (confirmado con `aws ec2 describe-instance-types
  # --filters free-tier-eligible=true`; t4g.nano no aparece en esa lista,
  # t4g.micro si). No es una eleccion de diseno, es la unica opcion
  # arm64 pequena que la cuenta acepta hoy.
  instance_type               = "t4g.micro"
  subnet_id                   = aws_subnet.publica_bastion.id
  vpc_security_group_ids      = [aws_security_group.bastion.id]
  iam_instance_profile        = aws_iam_instance_profile.bastion.name
  associate_public_ip_address = true
  user_data                   = local.bastion_user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 8
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-bastion"
  }
}

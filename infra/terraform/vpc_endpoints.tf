# Las tasks de ECS corren en subredes privadas (assign_public_ip=false,
# ecs.tf) y esta VPC no tiene NAT Gateway - decision deliberada de hace
# varias sesiones (RDS no lo necesitaba). Confirmado en vivo 2026-07-30:
# la primera task real fallo repetidamente con "unable to retrieve secret
# from asm: ... connection issue between the task and AWS Secrets Manager"
# - Secrets Manager, ECR y CloudWatch Logs son endpoints PUBLICOS de AWS,
# sin ninguna ruta a internet la task no tiene forma de llegar ahi.
#
# Resuelto con VPC Endpoints en vez de agregar un NAT Gateway - decidido
# explicitamente con el usuario (costo similar, ~$29/mes en 4 Interface
# Endpoints vs ~$32/mes+transferencia en NAT, pero sin abrir ninguna ruta
# real a internet desde las tasks, mas acorde al principio de "subredes
# privadas de verdad" que ya se sigue con RDS).
#
# 4 Interface Endpoints (cada uno crea ENIs en las subredes privadas,
# con DNS privado habilitado para que el SDK de AWS dentro del contenedor
# resuelva el nombre normal del servicio hacia la IP privada sin ningun
# cambio de codigo) + 1 Gateway Endpoint de S3 (gratis, se asocia a la
# tabla de rutas en vez de via ENI - requerido porque ECR guarda las
# capas de imagen en S3 y el pull las trae de ahi aunque la llamada a la
# API en si pase por el endpoint de ecr.dkr).

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.project_name}-${var.environment}-vpc-endpoints"
  description = "HTTPS entrante solo desde el SG de las tasks de ECS, hacia los VPC Interface Endpoints"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTPS desde las tasks de ECS"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc-endpoints-sg"
  }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-secretsmanager"
  }
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-ecr-api"
  }
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-ecr-dkr"
  }
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-logs"
  }
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [var.private_route_table_id]

  tags = {
    Name = "${var.project_name}-${var.environment}-s3"
  }
}

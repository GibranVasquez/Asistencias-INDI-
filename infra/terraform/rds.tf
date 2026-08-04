resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnets"
  }
}

# El SG de las tasks de ECS (Fargate) - RDS confia en el trafico que sale
# de este SG (ver aws_security_group.rds abajo), no en un rango de IPs.
# Las ENIs de las tasks se crean con este SG independientemente de a
# cuantas tasks escale el servicio, asi que "solo desde el backend" no
# depende de mantener actualizada una lista de IPs. Renombrado de
# "apprunner" a "ecs_tasks" el 2026-07-28 al migrar de App Runner a ECS.
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks"
  description = "SG de las tasks de ECS/Fargate del backend (egress hacia la VPC, entre otras cosas hacia RDS)"
  vpc_id      = var.vpc_id

  # Sin esto el ALB no tiene ninguna forma de llegar al contenedor - el
  # healthcheck falla por timeout (no por el codigo de la app, que ya
  # escucha en 0.0.0.0 por default de Node cuando app.listen(port) no
  # especifica host) porque sin regla de ingress TODO el trafico entrante
  # se bloquea. Confirmado en vivo 2026-07-30: tasks reales terminaban en
  # SIGKILL (137) tras fallar el healthcheck repetidamente, exactamente
  # el sintoma esperado de este hueco.
  ingress {
    description     = "Healthcheck y trafico real del ALB hacia el backend"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Salida abierta - el filtrado real de acceso a RDS lo hace el SG de RDS, no este egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  }
}

resource "aws_security_group" "rds" {
  name = "${var.project_name}-${var.environment}-rds"
  # El campo description de un security_group es inmutable en AWS -
  # cualquier cambio aqui, sin importar cual, fuerza un destroy+recreate
  # del SG completo (confirmado en vivo dos veces: primero intentando
  # reescribirlo de "App Runner" a "ECS", luego con un texto generico
  # nuevo - ambos mostraron "forces replacement" en el plan). Para
  # environment == "production" (el SG real de us-east-1, ya existente) se
  # deja exactamente igual al valor ya existente en AWS a proposito, aunque
  # ya mencione App Runner y el compute layer real ahora sea ECS - el
  # detalle correcto y actualizado vive en la description de cada regla de
  # ingress de abajo, que si se puede modificar sin reemplazar el SG.
  # Cualquier otro ambiente (ej. production-mx) todavia no tiene un SG real
  # que preservar, asi que puede usar un texto correcto desde el inicio.
  description = var.environment == "production" ? "Postgres RDS - unico ingreso permitido: el SG del VPC Connector de App Runner" : "Security group para RDS de indi-asistencia en ${var.environment} (${var.aws_region})"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres (5432) unicamente desde el SG de las tasks de ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # Bastion SSM (infra/terraform-network/) - unico proposito: permitir
  # `prisma migrate deploy` desde una maquina de desarrollo via tunel de
  # SSM Session Manager (ver infra/terraform-network/README.md). El
  # bastion en si no tiene ningun puerto abierto a internet - el acceso a
  # el mismo es por IAM (Session Manager), no por red.
  ingress {
    description     = "Postgres (5432) unicamente desde el SG del bastion SSM"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.bastion_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  }
}

# special=false (sin caracteres especiales) es deliberado: un password con
# un caracter como "#" sin URL-encodear rompe silenciosamente el parseo de
# DATABASE_URL (nos paso de verdad migrando a Supabase esta misma semana -
# el "#" se interpreta como fragment de la URL y trunca todo lo que sigue).
# Puramente alfanumerico evita esa clase entera de bug sin necesitar
# encoding en ningun lado.
resource "random_password" "db_master_password" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_master_username
  password = random_password.db_master_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  multi_az                = var.db_multi_az
  backup_retention_period = var.db_backup_retention_days
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  # Identificador fijo (no timestamp(), que cambiaria en cada plan y
  # generaria un diff perpetuo) - si algun dia se destruye/recrea esta
  # instancia en un ambiente donde skip_final_snapshot es false, hay que
  # bumpear este nombre a mano para evitar un choque con el snapshot previo.
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-final-snapshot" : null

  tags = {
    Name = "${var.project_name}-${var.environment}-postgres"
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnets"
  }
}

# El SG del VPC Connector de App Runner - RDS confia en el trafico que sale
# de este SG (ver aws_security_group.rds abajo), no en un rango de IPs. Las
# ENIs del connector se crean con este SG independientemente de a cuantas
# instancias escale el servicio, asi que "solo desde App Runner" no depende
# de mantener actualizada una lista de IPs.
resource "aws_security_group" "apprunner" {
  name        = "${var.project_name}-${var.environment}-apprunner"
  description = "SG del VPC Connector de App Runner (egress hacia la VPC, entre otras cosas hacia RDS)"
  vpc_id      = var.vpc_id

  egress {
    description = "Salida abierta - el filtrado real de acceso a RDS lo hace el SG de RDS, no este egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-apprunner-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds"
  description = "Postgres RDS - unico ingreso permitido: el SG del VPC Connector de App Runner"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres (5432) unicamente desde el SG de App Runner"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner.id]
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

# JWT_SECRET: generado como recurso random de Terraform, nunca escrito a
# mano (a diferencia del valor que se genero manualmente para Railway con
# `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`,
# aqui el equivalente lo genera el propio Terraform). special=false evita
# tener que pensar en escaping/encoding en ningun lugar donde este valor se
# use como texto plano.
resource "random_password" "jwt_secret" {
  length  = 128
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.project_name}/${var.environment}/jwt-secret"
  description = "JWT_SECRET (jsonwebtoken) - generado por random_password, nunca escrito a mano"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# Password del usuario maestro de RDS, guardado tambien como JSON
# {username, password} - mismo shape que usa el secret nativo de AWS
# cuando se activa manage_master_user_password, por si mas adelante se
# quiere migrar a esa gestion 100% administrada por AWS (en ese caso el
# password nunca pasa por el state de Terraform; hoy si pasa, ver nota en
# rds.tf/README sobre asegurar el backend de estado).
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${var.project_name}/${var.environment}/db-password"
  description = "Password del usuario maestro de RDS Postgres"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = var.db_master_username
    password = random_password.db_master_password.result
  })
}

# DATABASE_URL/DIRECT_URL completas. Sin RDS Proxy (ver decision razonada
# en README.md de esta carpeta), las dos apuntan al mismo endpoint de RDS
# - a diferencia del pooler de Supabase, aqui no hay una distincion real
# pooled-vs-directa que preservar.
locals {
  database_url = "postgresql://${var.db_master_username}:${random_password.db_master_password.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}?sslmode=require"
}

resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.project_name}/${var.environment}/database-url"
  description = "Connection string completa - referenciada como DATABASE_URL y DIRECT_URL en App Runner"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

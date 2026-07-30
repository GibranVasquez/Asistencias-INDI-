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
#
# SIN "?sslmode=require" a proposito - bug real encontrado en vivo
# 2026-07-30: la version instalada de pg-connection-string trata
# "sslmode=require" como alias de "verify-full" (cambio de comportamiento
# documentado en su propio warning en runtime), y ese modo, combinado con
# el objeto ssl explicito que ya arma src/utils/prisma.ts (rejectUnauthorized
# + ca pinneado), termina validando la cadena contra el almacen de CAs por
# default de Node en vez de contra el CA explicito - "self-signed
# certificate in certificate chain" pese a que el CA correcto SI se estaba
# leyendo y pasando bien. Aislado con una prueba minima usando pg puro (sin
# Prisma): la misma connectionString+ssl explicito conecta bien sin este
# parametro, y falla con el. El objeto ssl explicito en prisma.ts ya es
# suficiente para forzar TLS+verificacion real - este parametro de URL es
# redundante y, con esta version de la libreria, activamente dañino.
locals {
  database_url = "postgresql://${var.db_master_username}:${random_password.db_master_password.result}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.db_name}"
}

resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.project_name}/${var.environment}/database-url"
  description = "Connection string completa - referenciada como DATABASE_URL y DIRECT_URL en la task de ECS"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

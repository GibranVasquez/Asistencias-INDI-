# Bootstrap del backend remoto de Terraform (bucket S3 + tabla DynamoDB de
# locking). Vive en un directorio APARTE de infra/terraform/ a propósito:
# es el clásico problema del huevo y la gallina - el stack principal no
# puede usar como backend remoto un bucket que todavía no existe, así que
# esto se aplica UNA VEZ, con state local (este state SÍ puede quedarse
# local: no contiene secrets, solo la definición de un bucket vacío y una
# tabla vacía).
#
# Orden real de ejecución cuando exista la cuenta de AWS (ver
# ../AWS_MIGRATION.md, es el paso 0, antes que cualquier otro recurso):
#   1. cd infra/terraform-bootstrap && terraform init && terraform apply
#   2. Copiar los outputs (nombre del bucket, nombre de la tabla) a
#      infra/terraform/versions.tf (descomentar el bloque backend "s3")
#   3. cd ../terraform && terraform init (migra a usar el backend remoto)

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend local intencional: este es el ÚNICO state de todo el proyecto
  # que puede quedarse en disco - no contiene ningún secreto, solo la
  # definición de un bucket S3 y una tabla DynamoDB vacíos.
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "tfstate" {
  bucket = var.bucket_name

  # Protección contra un `terraform destroy` accidental de este bootstrap
  # mientras el bucket todavía tenga el state real del stack principal
  # adentro - hay que quitar esto a mano si de verdad se quiere destruir.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-S3 (AES256), no una KMS key propia: cifrado real en reposo sin la
# complejidad adicional de administrar una key/politica de KMS en esta
# etapa. Reconsiderar si en algun momento hay un requisito de compliance
# que exija llaves administradas por el cliente.
resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tfstate_lock" {
  name         = var.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

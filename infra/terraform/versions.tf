terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend de estado intencionalmente sin configurar todavía: la cuenta de
  # AWS no existe, y con ella tampoco el bucket S3 + tabla DynamoDB que este
  # bloque necesita (ver ../terraform-bootstrap/, que los crea). Mientras
  # tanto el estado queda local (terraform.tfstate, gitignoreado) - pero
  # ESO NO ES ACEPTABLE para un apply real: el state va a contener el
  # password de RDS (random_password.db_master_password) y el JWT_SECRET
  # (random_password.jwt_secret) en texto plano, comportamiento normal y
  # esperado de random_password, no un bug.
  #
  # Antes de correr `terraform apply` contra una cuenta real (primer paso,
  # antes que cualquier otro recurso - ver ../AWS_MIGRATION.md):
  #   1. cd ../terraform-bootstrap && terraform init && terraform apply
  #   2. Descomentar el bloque de abajo, reemplazando <bucket> y <tabla>
  #      por los outputs reales de ese apply (bucket_name/dynamodb_table_name)
  #   3. cd ../terraform && terraform init  (Terraform va a ofrecer migrar
  #      el state local, existente o vacio, hacia S3 - aceptar)
  #
  # backend "s3" {
  #   bucket         = "<bucket>"           # output bucket_name del bootstrap
  #   key            = "indi-asistencia/terraform.tfstate"
  #   region         = "<misma region que var.aws_region>"
  #   dynamodb_table = "<tabla>"            # output dynamodb_table_name del bootstrap
  #   encrypt        = true
  # }
}

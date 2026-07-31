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

  # Backend remoto S3 - bucket/tabla creados por ../terraform-bootstrap/
  # (2026-07-28, apply real confirmado: bucket versionado, cifrado AES256,
  # con bloqueo de acceso publico, 5/5 recursos, ninguno tainted). El state
  # de este stack SI contiene secretos en claro (password de RDS via
  # random_password.db_master_password, JWT_SECRET via secrets.tf) - por
  # eso no puede quedarse local, a diferencia del bootstrap.
  backend "s3" {
    bucket         = "indi-asistencia-tfstate"
    key            = "indi-asistencia/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "indi-asistencia-tfstate-lock"
    encrypt        = true
  }
}

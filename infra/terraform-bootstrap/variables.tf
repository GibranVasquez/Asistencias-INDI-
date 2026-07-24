variable "aws_region" {
  description = "Misma region que se vaya a usar para infra/terraform/ (var.aws_region ahi) - el bucket de state normalmente vive en la misma region que los recursos que describe, aunque no es un requisito estricto de S3."
  type        = string
}

variable "bucket_name" {
  description = "Nombre del bucket S3 para el state remoto. Los nombres de bucket S3 son globalmente unicos (entre TODAS las cuentas de AWS, no solo la propia) - probablemente haga falta ajustar este valor si el nombre por default ya esta tomado por alguien mas."
  type        = string
  default     = "indi-asistencia-tfstate"
}

variable "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB usada para locking del state (evita que dos `terraform apply` corran al mismo tiempo y corrompan el state)."
  type        = string
  default     = "indi-asistencia-tfstate-lock"
}

variable "aws_region" {
  description = "Region de AWS. Debe coincidir con la misma variable en infra/terraform/ (main stack) - la VPC creada aqui es la que ese stack va a usar."
  type        = string
}

variable "project_name" {
  description = "Prefijo usado en el nombre de todos los recursos - mismo default que infra/terraform/variables.tf, para que ambos stacks queden bajo el mismo nombre logico de proyecto."
  type        = string
  default     = "indi-asistencia"
}

variable "environment" {
  description = "Nombre del ambiente - mismo default que infra/terraform/variables.tf."
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC nueva. 10.0.0.0/16 no choca con la VPC default de la cuenta (172.31.0.0/16) - relevante solo si algun dia se necesita peering entre ambas, no un requisito estricto hoy."
  type        = string
  default     = "10.0.0.0/16"
}

output "vpc_id" {
  description = "ID de la VPC - usar este valor exacto en terraform.tfvars de infra/terraform/ (variable vpc_id)."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "IDs de las subredes privadas - usar este valor exacto en terraform.tfvars de infra/terraform/ (variable private_subnet_ids)."
  value       = aws_subnet.privadas[*].id
}

output "bastion_instance_id" {
  description = "ID de la instancia del bastion - usar en el comando de aws ssm start-session (ver README)."
  value       = aws_instance.bastion.id
}

output "bastion_security_group_id" {
  description = "ID del Security Group del bastion - usar este valor exacto en terraform.tfvars de infra/terraform/ (variable bastion_security_group_id), para que el SG de RDS acepte conexiones desde el bastion."
  value       = aws_security_group.bastion.id
}

output "public_subnet_ids" {
  description = "IDs de ambas subredes publicas (bastion + la agregada para el ALB) - usar en terraform.tfvars de infra/terraform/ para el ALB de ECS clasico."
  value       = [aws_subnet.publica_bastion.id, aws_subnet.publica_alb.id]
}

output "private_route_table_id" {
  description = "ID de la tabla de rutas privada - usar en terraform.tfvars de infra/terraform/ (variable private_route_table_id) para el VPC Gateway Endpoint de S3 (requerido por ECR para almacenar/servir las capas de imagen, aunque el pull en si pase por el Interface Endpoint de ecr.dkr)."
  value       = aws_route_table.privada.id
}

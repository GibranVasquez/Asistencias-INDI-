output "backend_url" {
  description = "URL publica real del backend (dominio propio, no la de App Runner)"
  value       = "https://${var.backend_subdomain}.${var.root_domain_name}"
}

output "alb_dns_name" {
  description = "DNS name nativo del ALB - util para probar antes de que el DNS del dominio propague."
  value       = aws_lb.this.dns_name
}

output "route53_name_servers" {
  description = "Los 4 NS de la zona de Route 53 - copiar estos EXACTOS a la configuracion de nameservers del dominio en Namecheap (o el registrador que sea). Paso manual obligatorio, ver AWS_MIGRATION.md."
  value       = data.aws_route53_zone.this.name_servers
}

output "route53_zone_id" {
  description = "Zone ID de la zona de Route 53 real del dominio (unica para todos los workspaces, ver var.route53_zone_id)."
  value       = data.aws_route53_zone.this.zone_id
}

output "rds_endpoint" {
  description = "Endpoint (host) de la instancia RDS - privado, no accesible desde internet"
  value       = aws_db_instance.postgres.address
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR - aqui se hace docker push de la imagen construida desde backend/Dockerfile"
  value       = aws_ecr_repository.backend.repository_url
}

output "jwt_secret_arn" {
  description = "ARN del secret de JWT_SECRET en Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "database_url_secret_arn" {
  description = "ARN del secret con la connection string completa (DATABASE_URL/DIRECT_URL)"
  value       = aws_secretsmanager_secret.database_url.arn
}

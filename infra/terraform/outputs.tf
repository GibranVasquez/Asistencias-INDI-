output "apprunner_service_url" {
  description = "URL publica del servicio de App Runner"
  value       = aws_apprunner_service.backend.service_url
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

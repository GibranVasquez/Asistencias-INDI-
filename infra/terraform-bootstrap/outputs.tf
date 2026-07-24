output "bucket_name" {
  description = "Nombre del bucket - usar este valor exacto en el bloque backend \"s3\" de infra/terraform/versions.tf"
  value       = aws_s3_bucket.tfstate.id
}

output "dynamodb_table_name" {
  description = "Nombre de la tabla de locking - usar este valor exacto en el bloque backend \"s3\" de infra/terraform/versions.tf"
  value       = aws_dynamodb_table.tfstate_lock.name
}

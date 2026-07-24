# Repositorio de imagenes. La imagen misma se construye a partir de
# backend/Dockerfile y se sube con `docker build` + `docker push` (o un
# pipeline de CI) por fuera de Terraform - este recurso solo crea el
# repositorio donde vive esa imagen; aws_apprunner_service.backend (ver
# apprunner.tf) referencia la imagen ya subida ahi.
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar solo las ultimas 10 imagenes - evita acumular indefinidamente"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

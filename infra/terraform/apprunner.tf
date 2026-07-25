resource "aws_apprunner_vpc_connector" "this" {
  vpc_connector_name = "${var.project_name}-${var.environment}"
  subnets            = var.private_subnet_ids
  security_groups    = [aws_security_group.apprunner.id]
}

# Rol que App Runner asume para poder hacer pull de la imagen desde ECR.
# Distinto del rol de instancia de abajo: este solo se usa en el momento de
# obtener la imagen, no corre dentro del contenedor.
resource "aws_iam_role" "apprunner_ecr_access" {
  name = "${var.project_name}-${var.environment}-apprunner-ecr"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "build.apprunner.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Rol de instancia: el que corre DENTRO del contenedor en runtime. App
# Runner lo usa para resolver los `runtime_environment_secrets` (JWT_SECRET,
# DATABASE_URL/DIRECT_URL) - sin este permiso explicito a los 2 secrets
# concretos (no a todo Secrets Manager), el servicio arranca pero esas
# variables llegan vacias/con error.
resource "aws_iam_role" "apprunner_instance" {
  name = "${var.project_name}-${var.environment}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "tasks.apprunner.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_secrets_access" {
  name = "${var.project_name}-${var.environment}-secrets-access"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.database_url.arn,
      ]
    }]
  })
}

resource "aws_apprunner_auto_scaling_configuration_version" "this" {
  auto_scaling_configuration_name = "${var.project_name}-${var.environment}"
  min_size                        = var.apprunner_min_instances
  max_size                        = var.apprunner_max_instances
  max_concurrency                 = var.apprunner_max_concurrency
}

resource "aws_apprunner_service" "backend" {
  service_name = "${var.project_name}-${var.environment}"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      # Imagen construida desde backend/Dockerfile y subida a ECR fuera de
      # Terraform (docker build + docker push, o CI) - este recurso solo
      # referencia la imagen ya existente, no la construye.
      image_identifier      = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = tostring(var.container_port)

        # Variables planas (no secretas). PORT: src/index.ts ya lee
        # process.env.PORT - se le pasa el mismo valor configurado como
        # puerto del contenedor para que ambos queden consistentes.
        runtime_environment_variables = {
          NODE_ENV                = var.node_env
          ALLOWED_ORIGIN          = var.allowed_origin
          JWT_EXPIRES_IN          = var.jwt_expires_in
          JWT_EXPIRES_IN_TERMINAL = var.jwt_expires_in_terminal
          ADMS_IPS_PERMITIDAS     = var.adms_ips_permitidas
          PORT                    = tostring(var.container_port)
        }

        # DIRECT_URL apunta al mismo secret que DATABASE_URL a proposito -
        # ver nota en secrets.tf (sin RDS Proxy no hay pooled-vs-directa
        # que preservar en RDS, a diferencia de Supabase).
        runtime_environment_secrets = {
          JWT_SECRET   = aws_secretsmanager_secret.jwt_secret.arn
          DATABASE_URL = aws_secretsmanager_secret.database_url.arn
          DIRECT_URL   = aws_secretsmanager_secret.database_url.arn
        }
      }
    }

    # false por default (ver variables.tf): mientras no haya CI, un
    # redeploy deberia ser una accion deliberada, no automatica al primer
    # push a ECR.
    auto_deployments_enabled = var.auto_deployments_enabled
  }

  instance_configuration {
    cpu               = var.apprunner_cpu
    memory            = var.apprunner_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.this.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = var.health_check_path
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.this.arn

  tags = {
    Name = "${var.project_name}-${var.environment}-backend"
  }
}

# Backend en ECS (Fargate) + Application Load Balancer - reemplaza
# apprunner.tf (2026-07-28). App Runner dejo de aceptar clientes nuevos
# desde el 30 de abril de 2026 (confirmado con la documentacion oficial
# de AWS, docs.aws.amazon.com/apprunner/latest/dg/setting-up.html) y esta
# cuenta nunca lo habia usado - no es un problema de permisos ni de
# configuracion, es una politica de producto sin mecanismo de reversion.
#
# Se eligio ECS clasico (Fargate + ALB a mano) sobre "ECS Express Mode"
# (aws_ecs_express_gateway_service) tras encontrar 7 bugs reales
# documentados en el CHANGELOG.md del provider para ese recurso en sus
# primeras ~4 semanas de vida (incluye 2 errores "inconsistent result
# after apply", uno de ellos activado especificamente por variables de
# entorno en orden no alfabetico) - este sistema maneja nomina real y
# datos biometricos, no vale la pena apostarle la pieza mas critica del
# stack a un recurso tan nuevo para ahorrar ~9 recursos de Terraform.
# Ver CLAUDE.md para el detalle completo de la decision.

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-${var.environment}-backend"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-logs"
  }
}

# Rol de ejecucion: pull de la imagen desde ECR + logs a CloudWatch + leer
# los secrets referenciados en la task definition. A diferencia de App
# Runner, ECS no tiene un concepto separado de "rol de instancia" - no
# hace falta uno aqui porque el codigo del backend no llama ningun SDK de
# AWS en tiempo de ejecucion (confirmado con grep sobre backend/src/ y
# las dependencias de package.json - ver CLAUDE.md, seccion de la
# decision del NAT Gateway, mismo hallazgo).
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project_name}-${var.environment}-ecs-secrets-access"
  role = aws_iam_role.ecs_execution.id

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

# ---------------------------------------------------------------------
# Application Load Balancer
# ---------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-${var.environment}-alb"
  description = "ALB del backend - ingreso 80/443 desde internet, egress hacia el SG de las tasks de ECS"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP - solo para redirigir a HTTPS, nunca sirve trafico real"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

resource "aws_lb" "this" {
  name               = "${var.project_name}-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "backend" {
  # "-be" en vez de "-backend": el nombre de un target group tiene un
  # limite duro de AWS de 32 caracteres - "indi-asistencia-production-
  # backend" (34) lo excede, confirmado en vivo con un terraform plan real
  # ("name" cannot be longer than 32 characters). El tag Name (abajo) si
  # queda completo y descriptivo, solo el campo name de AWS se acorta.
  name        = "${var.project_name}-${var.environment}-be"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # requerido para Fargate (awsvpc network mode)

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 15
    timeout             = 5
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-tg"
  }
}

# HTTPS real - unico listener que de verdad reenvia trafico al backend.
# Requiere que aws_acm_certificate_validation.backend (dns.tf) haya
# terminado - ver la nota de orden obligatorio en dns.tf y
# AWS_MIGRATION.md antes de aplicar esto.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.backend.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  depends_on = [aws_acm_certificate_validation.backend]
}

# Puerto 80: SOLO redirige a 443, nunca sirve trafico sin cifrar - este
# sistema maneja nomina real y datos biometricos.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ---------------------------------------------------------------------
# ECS
# ---------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = "${var.project_name}-${var.environment}"

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-${var.environment}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc" # obligatorio para Fargate
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  # Sin task_role_arn a proposito - ver comentario de aws_iam_role.ecs_execution.

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]

      # Orden alfabetico a proposito - el CHANGELOG del provider de AWS
      # documenta un bug real (aws_ecs_express_gateway_service, issue
      # #46771) donde variables de entorno en orden no alfabetico
      # rompian el apply. No hay evidencia de que aws_ecs_task_definition
      # (este recurso) tenga el mismo bug, pero es una precaucion barata.
      environment = [
        { name = "ADMS_IPS_PERMITIDAS", value = var.adms_ips_permitidas },
        { name = "ALLOWED_ORIGIN", value = var.allowed_origin },
        { name = "JWT_EXPIRES_IN", value = var.jwt_expires_in },
        { name = "JWT_EXPIRES_IN_TERMINAL", value = var.jwt_expires_in_terminal },
        { name = "NODE_ENV", value = var.node_env },
        { name = "PORT", value = tostring(var.container_port) },
      ]

      # DIRECT_URL apunta al mismo secret que DATABASE_URL a proposito -
      # ver nota en secrets.tf (sin RDS Proxy no hay pooled-vs-directa que
      # preservar en RDS, a diferencia de Supabase).
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "DIRECT_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-${var.environment}-backend"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.ecs_min_tasks
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false # las tasks viven en subredes privadas, igual que RDS
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  # Sin esto, ECS podria intentar registrar tasks contra el target group
  # antes de que el listener este listo para recibir trafico.
  depends_on = [aws_lb_listener.https]

  tags = {
    Name = "${var.project_name}-${var.environment}-backend"
  }
}

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = var.ecs_max_tasks
  min_capacity       = var.ecs_min_tasks
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs" {
  name               = "${var.project_name}-${var.environment}-requests-per-task"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = var.ecs_scaling_requests_per_task

    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.this.arn_suffix}/${aws_lb_target_group.backend.arn_suffix}"
    }
  }
}

# Segunda capa de defensa para /iclock/* (protocolo ADMS, sin
# autenticacion propia — ver CLAUDE.md sección ADMS y
# middlewares/restringirPorIP.ts). La primera capa (ADMS_IPS_PERMITIDAS,
# aplicada en el propio backend) funciona en cualquier plataforma de
# despliegue y ya protege hoy; esta es adicional y específica de AWS.
#
# Asociado al Application Load Balancer (aws_lb.this, ver ecs.tf) desde
# 2026-07-28 (antes al servicio de App Runner directamente, antes de la
# migración a ECS) — WAFv2 soporta asociarse a un ALB de forma nativa,
# de hecho es el caso de uso más común de los dos.
#
# OJO: este Web ACL protege TODO el ALB (WAF no puede aplicarse solo a
# una ruta específica como /iclock/*), no solo el endpoint ADMS — la
# regla de IP solo bloquea tráfico que NO venga del rango permitido, así
# que el resto de la API (consumida por Electron empaquetado, sin IP de
# origen fija de oficina) seguiría funcionando igual salvo que se decida
# escribir una regla más específica por path. Por ahora, dado que el
# parque real de clientes Electron no tiene una IP de origen conocida/
# fija, esta capa se deja pensada específicamente para reforzar
# /iclock/*, documentado como tal — aplicar con cuidado si algún día se
# decide usar en todo el servicio.

resource "aws_wafv2_ip_set" "adms_oficina" {
  name               = "${var.project_name}-${var.environment}-adms-oficina"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  # var.adms_ips_permitidas viaja como IP(s) sueltas (formato que espera
  # restringirPorIP.ts - comparacion exacta contra req.ip, sin CIDR) - WAF
  # exige notacion CIDR valida ("x.x.x.x/32"), asi que la transformacion
  # va aqui, no en la variable compartida (poner "/32" directo en la
  # variable rompería la comparacion exacta del backend).
  addresses = [for ip in split(",", var.adms_ips_permitidas) : "${trimspace(ip)}/32"]
}

resource "aws_wafv2_web_acl" "adms" {
  name        = "${var.project_name}-${var.environment}-adms"
  # Sin "*" a proposito: el campo description de un Web ACL de WAFv2 solo
  # acepta ^[\w+=:#@/\-,\.][\w+=:#@/\-,\.\s]+[\w+=:#@/\-,\.]$ - confirmado
  # en vivo con un ValidationException real al incluir "/iclock/*" (el
  # asterisco no esta en el charset permitido).
  description = "Permite rutas /iclock/ solo desde la IP publica de la oficina de Grupo INDI - segunda capa, ver ADMS_IPS_PERMITIDAS para la primera."
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "bloquear-iclock-fuera-de-oficina"
    priority = 1

    action {
      block {}
    }

    statement {
      and_statement {
        statement {
          byte_match_statement {
            search_string = "/iclock/"
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
        statement {
          not_statement {
            statement {
              ip_set_reference_statement {
                arn = aws_wafv2_ip_set.adms_oficina.arn
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-bloquear-iclock"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-${var.environment}-adms-waf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "adms" {
  resource_arn = aws_lb.this.arn
  web_acl_arn  = aws_wafv2_web_acl.adms.arn
}

# Logging del WAF - sin esto, un bloqueo real (ej. IP de oficina cambio y
# el allowlist empezo a rechazar trafico legitimo) no deja ningun rastro
# auditable: solo se sabria "algo se esta rechazando" por la alerta de
# inactividad del Dashboard, nunca CUAL IP/request especifico. El nombre
# del log group DEBE empezar con "aws-waf-logs-" - requisito duro de AWS
# para que WAFv2 pueda escribir a CloudWatch Logs sin una resource policy
# manual aparte (AWS gestiona ese permiso automaticamente solo con este
# prefijo de nombre).
resource "aws_cloudwatch_log_group" "waf_adms" {
  name              = "aws-waf-logs-${var.project_name}-${var.environment}-adms"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-waf-adms-logs"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "adms" {
  resource_arn            = aws_wafv2_web_acl.adms.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_adms.arn]
}

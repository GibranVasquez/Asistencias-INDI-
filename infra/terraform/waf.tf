# Segunda capa de defensa para /iclock/* (protocolo ADMS, sin
# autenticacion propia — ver CLAUDE.md sección ADMS y
# middlewares/restringirPorIP.ts). La primera capa (ADMS_IPS_PERMITIDAS,
# aplicada en el propio backend) funciona en cualquier plataforma de
# despliegue y ya protege hoy; esta es adicional y específica de
# AWS/App Runner — confirmado que un Web ACL de WAF sí puede asociarse
# directamente a un servicio público de App Runner (no hace falta
# CloudFront ni cambiar de App Runner a un modelo con ALB).
#
# OJO: este Web ACL protege TODO el servicio de App Runner (WAF no puede
# aplicarse solo a una ruta específica como /iclock/*), no solo el
# endpoint ADMS — la regla de IP solo bloquea tráfico que NO venga del
# rango permitido, así que el resto de la API (consumida por Electron
# empaquetado, sin IP de origen fija de oficina) seguiría funcionando
# igual salvo que se decida escribir una regla más específica por path.
# Por ahora, dado que el appset real de clientes Electron no tiene una IP
# de origen conocida/fija, esta capa se deja pensada específicamente para
# reforzar /iclock/*, documentado como tal — aplicar con cuidado si algún
# día se decide usar en todo el servicio.

resource "aws_wafv2_ip_set" "adms_oficina" {
  name               = "${var.project_name}-${var.environment}-adms-oficina"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = split(",", var.adms_ips_permitidas)
}

resource "aws_wafv2_web_acl" "adms" {
  name        = "${var.project_name}-${var.environment}-adms"
  description = "Permite /iclock/* solo desde la IP publica de la oficina de Grupo INDI - segunda capa, ver ADMS_IPS_PERMITIDAS para la primera."
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
  resource_arn = aws_apprunner_service.backend.arn
  web_acl_arn  = aws_wafv2_web_acl.adms.arn
}

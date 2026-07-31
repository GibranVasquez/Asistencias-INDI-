# Route 53 + ACM para exponer el backend en https://api.${var.root_domain_name}
# (2026-07-28, parte de la migracion de App Runner a ECS/ALB - ver ecs.tf
# y CLAUDE.md). El dominio se compra fuera de Terraform (ej. Namecheap) -
# no se registro directamente en Route 53, asi que la zona se crea aqui
# como recurso (no como data source de una zona ya existente).
#
# ORDEN OBLIGATORIO, no opcional - ver infra/AWS_MIGRATION.md para el
# detalle completo: comprar el dominio -> aplicar SOLO aws_route53_zone.this
# (via -target) -> copiar los 4 NS que devuelve a Namecheap -> ESPERAR
# propagacion real (verificar con `dig NS`) -> recien entonces correr el
# apply completo (que crea el certificado + su validacion). Si el
# certificado se aplica antes de que la delegacion de NS haya propagado
# publicamente, la validacion de ACM se queda esperando indefinidamente un
# registro DNS que sus servidores de validacion todavia no pueden ver -
# no es una condicion de carrera de Terraform, es que el propio DNS
# publico todavia no resuelve hacia la zona nueva.

resource "aws_route53_zone" "this" {
  name = var.root_domain_name

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }
}

resource "aws_acm_certificate" "backend" {
  domain_name       = "api.${var.root_domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend"
  }
}

# Automatizado por completo: controlamos ambos lados (la zona Y el
# registro de validacion dentro de ella), asi que no hace falta ningun
# paso manual de copiar/pegar un CNAME - a diferencia de la delegacion de
# NS hacia Namecheap (esa si es un paso manual real, cruza de proveedor).
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.backend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "backend" {
  certificate_arn         = aws_acm_certificate.backend.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Registro real que hace que "api.${var.root_domain_name}" resuelva hacia
# el ALB - sin esto, el certificado existiria pero nada apuntaria al ALB
# todavia.
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "api.${var.root_domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

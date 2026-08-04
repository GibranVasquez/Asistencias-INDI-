# Route 53 + ACM para exponer el backend en https://${var.backend_subdomain}.${var.root_domain_name}
# (2026-07-28, parte de la migracion de App Runner a ECS/ALB - ver ecs.tf
# y CLAUDE.md). El dominio se compro fuera de Terraform (Namecheap) y la
# zona de Route 53 ya se creo (una sola vez, via el flujo de -target
# documentado en infra/AWS_MIGRATION.md: comprar el dominio -> aplicar SOLO
# aws_route53_zone.this -> copiar los 4 NS a Namecheap -> esperar
# propagacion real -> recien entonces el apply completo). Esa zona
# (Z01688701AOYXKKFDBYVP, var.route53_zone_id) es unica para el dominio
# real y se comparte entre TODOS los workspaces/regiones (default y
# mexico incluidos) - por eso esto es un data source, no un resource: cada
# workspace apunta al mismo Zone ID ya existente en vez de crear una zona
# propia (que duplicaria la zona real y dejaria la delegacion de NS del
# registrador apuntando a la zona equivocada).

data "aws_route53_zone" "this" {
  zone_id = var.route53_zone_id
}

resource "aws_acm_certificate" "backend" {
  domain_name       = "${var.backend_subdomain}.${var.root_domain_name}"
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

  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "backend" {
  certificate_arn         = aws_acm_certificate.backend.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Registro real que hace que "${var.backend_subdomain}.${var.root_domain_name}"
# resuelva hacia el ALB - sin esto, el certificado existiria pero nada
# apuntaria al ALB todavia.
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "${var.backend_subdomain}.${var.root_domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

# Deteccion automatica de drift entre los archivos locales
# iam-provisioning-policy-{compute,datos}.json y lo REALMENTE aplicado en
# la consola de AWS (ver README.md, "Permisos IAM de aprovisionamiento").
#
# Motivacion: 3 incidentes reales de desincronizacion en la misma sesion
# (2026-07-30) - un permiso nuevo agregado al archivo local que nunca se
# reflejo en la consola, descubierto cada vez por un error de permisos a
# medias durante un apply real, no de forma proactiva. Estas dos data
# sources leen la version activa de cada politica directamente de AWS
# (data.aws_iam_policy.*.policy) y el postcondition compara ese contenido
# real contra el archivo local en cada plan/apply - si no coinciden, falla
# explicito con un mensaje claro, antes de intentar cualquier otra cosa.
#
# jsondecode() en ambos lados: la comparacion es por estructura, no por
# texto - el orden de las keys de un objeto no importa (Terraform ya lo
# maneja bien). Limitacion conocida y aceptada: si el orden de los
# ELEMENTOS DENTRO de un array (Action/Resource) llegara a diferir entre
# el archivo y la consola, esto marcaria un falso positivo - no deberia
# pasar con el flujo ya establecido (pegar el archivo completo en la
# consola, nunca editar a mano ahi), asi que se acepta ese riesgo menor a
# cambio de mantener esto simple.
data "aws_iam_policy" "compute_actual" {
  # arn, no name: buscar por name dispara iam:ListPolicies (accion de
  # alcance de cuenta completa, no acotable por ARN especifico) - por arn
  # usa iam:GetPolicy directo, que si se puede acotar a estos 2 ARNs
  # exactos (ver IAMLeerPoliticasPropiasParaDetectarDrift en
  # iam-provisioning-policy-datos.json). Confirmado en vivo: la variante
  # por name fallo con AccessDenied sobre ListPolicies.
  arn = "arn:aws:iam::183537898129:policy/indi-provisioning-policy"

  lifecycle {
    postcondition {
      condition     = jsondecode(self.policy) == jsondecode(file("${path.module}/iam-provisioning-policy-compute.json"))
      error_message = "DRIFT DETECTADO: iam-provisioning-policy-compute.json (local) no coincide con la version aplicada en la consola de AWS para la politica 'indi-provisioning-policy'. Pega el contenido completo y actual de ese archivo en la consola (IAM > Policies > indi-provisioning-policy) antes de continuar."
    }
  }
}

data "aws_iam_policy" "datos_actual" {
  arn = "arn:aws:iam::183537898129:policy/indi-provisioning-policy-datos"

  lifecycle {
    postcondition {
      condition     = jsondecode(self.policy) == jsondecode(file("${path.module}/iam-provisioning-policy-datos.json"))
      error_message = "DRIFT DETECTADO: iam-provisioning-policy-datos.json (local) no coincide con la version aplicada en la consola de AWS para la politica 'indi-provisioning-policy-datos'. Pega el contenido completo y actual de ese archivo en la consola (IAM > Policies > indi-provisioning-policy-datos) antes de continuar."
    }
  }
}

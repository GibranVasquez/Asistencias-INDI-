# Variables sin default: dependen de una cuenta de AWS real que todavia no
# existe. Hay que llenarlas (via terraform.tfvars, no comiteado, o -var) el
# dia que se haga el primer apply real - ver infra/terraform/terraform.tfvars.example.

variable "aws_region" {
  description = "Region de AWS donde se crean todos los recursos. Sin default a proposito: no se puede asumir todavia (candidata razonable: us-east-1, misma region que el proyecto de Supabase actual, para minimizar latencia durante una eventual migracion de datos - pero es decision del usuario, no algo que este codigo deba asumir)."
  type        = string
}

variable "vpc_id" {
  description = "VPC donde vive la subred privada de RDS y el VPC Connector de App Runner. No existe todavia."
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas (al menos 2, en AZs distintas) para el DB subnet group de RDS y el VPC Connector de App Runner. No existen todavia."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "RDS necesita al menos 2 subnets en AZs distintas para su subnet group."
  }
}

variable "project_name" {
  description = "Prefijo usado en el nombre de todos los recursos."
  type        = string
  default     = "indi-asistencia"
}

variable "environment" {
  description = "Nombre del ambiente (afecta deletion_protection y skip_final_snapshot de RDS)."
  type        = string
  default     = "production"
}

# --- RDS ---

variable "db_engine_version" {
  description = "Version de motor de Postgres. 17.4 como default porque Supabase (la base actual) corre Postgres 17.6 hoy (confirmado con SELECT version()) - CONFIRMAR la minor version real disponible en la region elegida con `aws rds describe-db-engine-versions --engine postgres` antes del primer apply, puede no coincidir exactamente."
  type        = string
  default     = "17.4"
}

variable "db_instance_class" {
  description = "Clase de instancia RDS. db.t4g.micro (Graviton, econonima) es punto de partida razonable para la escala actual del proyecto (~137 trabajadores, uso interno de oficina, no trafico publico masivo) - subir si el volumen real lo justifica."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Almacenamiento inicial en GB. max_allocated_storage (autoscaling de storage) se calcula como el doble de este valor."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Nombre de la base de datos dentro de la instancia RDS."
  type        = string
  default     = "indi_asistencia"
}

variable "db_master_username" {
  description = "Usuario maestro de Postgres. El password se genera con random_password (ver secrets.tf), nunca se escribe a mano."
  type        = string
  default     = "indi_app"
}

variable "db_backup_retention_days" {
  description = "Dias de retencion de backups automaticos de RDS."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Multi-AZ (failover automatico) - false por default: mas caro (duplica el costo de computo de RDS) y esta escala/etapa del proyecto no lo justifica todavia. Reconsiderar junto con la decision de RDS Proxy si el uso real crece."
  type        = bool
  default     = false
}

# --- App Runner ---

variable "container_port" {
  description = "Puerto en el que escucha el contenedor (src/index.ts ya lee process.env.PORT, con fallback a 4000 solo para dev local - aqui se le pasa explicito via runtime_environment_variables)."
  type        = number
  default     = 4000
}

variable "apprunner_cpu" {
  description = "vCPU del servicio de App Runner. Combinaciones validas de AWS: 0.25/0.5/1/2/4 vCPU con memoria especifica por cada una - ver apprunner_memory."
  type        = string
  default     = "0.25 vCPU"
}

variable "apprunner_memory" {
  description = "Memoria del servicio de App Runner (debe ser una combinacion valida junto con apprunner_cpu, ver docs de AWS App Runner)."
  type        = string
  default     = "0.5 GB"
}

variable "apprunner_min_instances" {
  description = "Instancias minimas siempre activas (auto scaling de App Runner, no confundir con capacidad de conexiones a RDS - ver decision de RDS Proxy en el README de esta carpeta)."
  type        = number
  default     = 1
}

variable "apprunner_max_instances" {
  description = "Tope de instancias concurrentes bajo carga."
  type        = number
  default     = 3
}

variable "apprunner_max_concurrency" {
  description = "Peticiones concurrentes por instancia antes de escalar a una instancia nueva."
  type        = number
  default     = 100
}

variable "auto_deployments_enabled" {
  description = "Si App Runner redespliega solo al detectar un push nuevo a la imagen de ECR. false por default a proposito: mientras no haya CI, un redeploy deberia ser una accion deliberada (docker push + trigger manual), no automatica."
  type        = bool
  default     = false
}

variable "image_tag" {
  description = "Tag de la imagen en ECR que va a correr App Runner (construida desde backend/Dockerfile y subida fuera de Terraform)."
  type        = string
  default     = "latest"
}

variable "health_check_path" {
  description = "Path del healthcheck de App Runner - GET /health ya existe en el backend."
  type        = string
  default     = "/health"
}

# --- Variables de entorno de la app (no-secretas) ---

variable "node_env" {
  description = "NODE_ENV del proceso - gatea los rate limits estrictos en middlewares/rateLimit.ts."
  type        = string
  default     = "production"
}

variable "jwt_expires_in" {
  description = "Duracion de los JWT de sesion humana (auth.service.ts) - 8h por default, igual que el codigo (ver src/services/auth.service.ts)."
  type        = string
  default     = "8h"
}

variable "jwt_expires_in_terminal" {
  description = "Duracion de los JWT de Terminal/kiosco (terminalAuth.service.ts) - mucho mas larga a proposito: un kiosco fisico no tiene quien vuelva a teclear credenciales cuando expire."
  type        = string
  default     = "30d"
}

variable "adms_ips_permitidas" {
  description = "IP(s) publica(s) de la oficina de Grupo INDI desde donde se acepta /iclock/* (protocolo ADMS del lector ZKTeco MB10-VL) - separadas por coma si hay mas de una. El protocolo no tiene autenticacion propia (ver CLAUDE.md, seccion ADMS) - esto es la mitigacion de aplicacion; el WAF de waf.tf es la segunda capa, especifica de AWS. Sin default: no se puede asumir la IP real todavia. En produccion (NODE_ENV=production, ver variables.tf/node_env), el backend rechaza TODO /iclock/* si esto llega vacio (fail-closed) - no dejar sin llenar en un apply real."
  type        = string
}

variable "allowed_origin" {
  description = "CORS ALLOWED_ORIGIN. El cliente real de produccion es Electron empaquetado (file://), que no manda header Origin - verificado empiricamente - asi que esta variable no lo afecta. Un valor que nunca vaya a coincidir con un origen web real es suficiente; no hace falta que 'apunte a donde vive el frontend'."
  type        = string
  default     = "https://no-aplica.grupoindi.local"
}

variable "tags" {
  description = "Tags adicionales a fusionar con los tags por default (Project/Environment/ManagedBy)."
  type        = map(string)
  default     = {}
}

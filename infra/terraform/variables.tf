# Variables sin default: dependen de una cuenta de AWS real que todavia no
# existe. Hay que llenarlas (via terraform.tfvars, no comiteado, o -var) el
# dia que se haga el primer apply real - ver infra/terraform/terraform.tfvars.example.

variable "aws_region" {
  description = "Region de AWS donde se crean todos los recursos. Sin default a proposito: no se puede asumir todavia (candidata razonable: us-east-1, misma region que el proyecto de Supabase actual, para minimizar latencia durante una eventual migracion de datos - pero es decision del usuario, no algo que este codigo deba asumir)."
  type        = string
}

variable "vpc_id" {
  description = "VPC donde vive la subred privada de RDS y de las tasks de ECS. No existe todavia."
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets privadas (al menos 2, en AZs distintas) para el DB subnet group de RDS y las tasks de ECS (Fargate). No existen todavia."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "RDS necesita al menos 2 subnets en AZs distintas para su subnet group."
  }
}

variable "public_subnet_ids" {
  description = "Subnets publicas (al menos 2, en AZs distintas) para el Application Load Balancer de ECS - infra/terraform-network/, output public_subnet_ids (incluye la subnet del bastion + la agregada especificamente para el ALB, ver terraform-network/README.md). Un ALB exige minimo 2 subnets en 2 AZs distintas."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "El ALB necesita al menos 2 subnets publicas en AZs distintas."
  }
}

variable "bastion_security_group_id" {
  description = "Security Group del bastion SSM (infra/terraform-network/, output bastion_security_group_id) - el SG de RDS acepta conexiones desde este SG ademas del de ECS, para poder correr `prisma migrate deploy` desde una maquina de desarrollo a traves de un tunel de SSM Session Manager (ver infra/terraform-network/README.md)."
  type        = string
}

variable "private_route_table_id" {
  description = "Tabla de rutas privada (infra/terraform-network/, output private_route_table_id) - usada por el VPC Gateway Endpoint de S3 (vpc_endpoints.tf). Necesaria porque las tasks de ECS en subredes privadas (sin NAT Gateway, decision deliberada) no tienen ninguna ruta a internet, y varias APIs de AWS que la task necesita en tiempo de arranque (Secrets Manager, ECR, CloudWatch Logs) son endpoints publicos - confirmado en vivo 2026-07-30: la primera task real fallo con 'unable to retrieve secret from asm: connection issue' exactamente por esto. Los VPC Interface Endpoints (secretsmanager/ecr.api/ecr.dkr/logs) resuelven el resto sin necesitar esta tabla de rutas - solo el Gateway Endpoint de S3 (requerido por ECR para las capas de imagen) se asocia a nivel de tabla de rutas en vez de via ENI."
  type        = string
}

variable "root_domain_name" {
  description = "Dominio raiz real (ej. \"sistemasindi.com\") - la zona de Route 53 para el ya existe (var.route53_zone_id, data source en dns.tf, no resource: el dominio no se registro directamente en Route 53). El backend queda expuesto en var.backend_subdomain de ese dominio. Sin default: no se puede asumir todavia - ver infra/AWS_MIGRATION.md para el orden obligatorio de pasos (comprar dominio -> crear zona -> copiar NS a Namecheap -> esperar propagacion -> recien entonces aplicar el certificado)."
  type        = string
}

variable "route53_zone_id" {
  description = "Zone ID de la zona real de Route 53 para root_domain_name (Z01688701AOYXKKFDBYVP, unica para todos los workspaces - nunca se debe overridear por workspace, ver dns.tf)."
  type        = string
  default     = "Z01688701AOYXKKFDBYVP"
}

variable "backend_subdomain" {
  description = "Subdominio del backend (api en produccion us-east-1, api-mx durante la fase paralela en mexico)."
  type        = string
  default     = "api"
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
  description = "Version de motor de Postgres. 17.6 porque Supabase (la base actual) corre esa version hoy (confirmado con SELECT version()) y esta disponible en us-east-1 - confirmado en vivo el 2026-07-30 con `aws rds describe-db-engine-versions --engine postgres` tras un primer intento real con 17.4 fallar con InvalidParameterCombination ('Cannot find version 17.4 for postgres', esa version no existe para este motor en ninguna region). Versiones 17.x reales disponibles en us-east-1 al momento de escribir esto: 17.5 a 17.10."
  type        = string
  default     = "17.6"
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
  description = "Dias de retencion de backups automaticos de RDS. Bajado de 7 a 1 el 2026-07-28: el default de 7 fallo en vivo contra esta cuenta real con FreeTierRestrictionError ('The specified backup retention period exceeds the maximum available to free tier customers') - la cuenta es nueva y esta bajo restricciones de Free Tier en varios recursos a la vez (mismo patron que el tipo de instancia EC2 del bastion). AWS no documenta el numero exacto permitido; 1 es el valor seguro minimo que preserva backups automaticos (0 los desactiva por completo) - pendiente de confirmar en vivo si un valor mayor tambien funciona una vez que la cuenta salga de estas restricciones."
  type        = number
  default     = 1
}

variable "db_multi_az" {
  description = "Multi-AZ (failover automatico) - false por default: mas caro (duplica el costo de computo de RDS) y esta escala/etapa del proyecto no lo justifica todavia. Reconsiderar junto con la decision de RDS Proxy si el uso real crece."
  type        = bool
  default     = false
}

# --- ECS (Fargate + ALB) ---
# Reemplaza App Runner (2026-07-28): App Runner dejo de aceptar clientes
# nuevos desde el 30 de abril de 2026 (confirmado con la documentacion
# oficial de AWS), y esta cuenta nunca lo habia usado - ver ecs.tf/dns.tf
# y CLAUDE.md para el detalle completo de la decision.

variable "container_port" {
  description = "Puerto en el que escucha el contenedor (src/index.ts ya lee process.env.PORT, con fallback a 4000 solo para dev local - aqui se le pasa explicito via las variables de entorno de la task definition)."
  type        = number
  default     = 4000
}

variable "backend_cpu" {
  description = "vCPU de la task de Fargate, en unidades de CPU (1024 = 1 vCPU). Combinaciones validas de AWS Fargate: 256/512/1024/2048/4096 con memoria especifica por cada una - ver backend_memory."
  type        = string
  default     = "256"
}

variable "backend_memory" {
  description = "Memoria de la task de Fargate en MiB (debe ser una combinacion valida junto con backend_cpu, ver docs de AWS Fargate)."
  type        = string
  default     = "512"
}

variable "ecs_min_tasks" {
  description = "Tasks minimas siempre activas (auto scaling de ECS, no confundir con capacidad de conexiones a RDS - ver decision de RDS Proxy en el README de esta carpeta)."
  type        = number
  default     = 1
}

variable "ecs_max_tasks" {
  description = "Tope de tasks concurrentes bajo carga."
  type        = number
  default     = 3
}

variable "ecs_scaling_requests_per_task" {
  description = "Peticiones promedio por task (metrica ALBRequestCountPerTarget) antes de escalar a una task nueva - equivalente al concepto de concurrencia por instancia que tenia App Runner."
  type        = number
  default     = 100
}

variable "image_tag" {
  description = "Tag de la imagen en ECR que va a correr la task de ECS (construida desde backend/Dockerfile y subida fuera de Terraform). Redeploys son manuales (`aws ecs update-service --force-new-deployment` tras un nuevo push) - ECS no tiene un toggle de auto-deploy como App Runner; requeriria EventBridge/CodePipeline aparte, no justificado todavia sin CI."
  type        = string
  default     = "latest"
}

variable "health_check_path" {
  description = "Path del healthcheck del target group del ALB - GET /health ya existe en el backend."
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

const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "ALLOWED_ORIGIN"] as const;

export function validarVariablesDeEntorno(): void {
  const faltantes = REQUIRED_ENV_VARS.filter((nombre) => !process.env[nombre]?.trim());

  if (faltantes.length > 0) {
    console.error(
      `No se puede iniciar el servidor: faltan variables de entorno requeridas: ${faltantes.join(", ")}. ` +
        "Revisa tu archivo .env (usa .env.example como referencia)."
    );
    process.exit(1);
  }
}

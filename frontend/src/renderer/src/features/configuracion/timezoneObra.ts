export function zonasIANAConfigurables(): string[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (clave: string) => string[] }).supportedValuesOf;
  if (!supportedValuesOf) return [];
  return supportedValuesOf("timeZone").filter((zona) => !zona.startsWith("Etc/GMT"));
}

export function etiquetaTimezoneObra(timezoneObra: string | null): string {
  return timezoneObra ?? "No configurada";
}

interface PrecisionLoaderProps {
  etiqueta?: string;
  pantallaCompleta?: boolean;
}

export default function PrecisionLoader({ etiqueta = "Verificando sesión", pantallaCompleta = false }: PrecisionLoaderProps) {
  return (
    <div
      className={`precision-loader-shell${pantallaCompleta ? " precision-loader-full" : ""}`}
      role="status"
      aria-label={etiqueta}
      data-testid={pantallaCompleta ? "auth-bootstrap" : undefined}
    >
      <span className="precision-loader" aria-hidden="true"><i /></span>
      <span className="precision-loader-label">{etiqueta}</span>
    </div>
  );
}

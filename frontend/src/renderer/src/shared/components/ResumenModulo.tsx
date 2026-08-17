import { ReactNode } from "react";

export interface ResumenModuloItem {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: "neutral" | "ok" | "warn" | "err";
}

interface ResumenModuloProps {
  etiqueta: string;
  items: ResumenModuloItem[];
  icono?: ReactNode;
}

export default function ResumenModulo({ etiqueta, items, icono }: ResumenModuloProps) {
  return (
    <section className="module-summary" aria-label={etiqueta}>
      <div className="module-summary-context">
        {icono && <span className="module-summary-icon" aria-hidden="true">{icono}</span>}
        <span>{etiqueta}</span>
      </div>
      <div className="module-summary-items">
        {items.map((item) => (
          <div className={`module-summary-item module-summary-${item.tono ?? "neutral"}`} key={item.etiqueta}>
            <span className="module-summary-label">{item.etiqueta}</span>
            <strong>{item.valor}</strong>
            {item.detalle && <small>{item.detalle}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

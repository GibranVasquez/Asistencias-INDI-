import { ReactNode } from "react";

interface EstadoVacioProps {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}

export default function EstadoVacio({ titulo, descripcion, accion }: EstadoVacioProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4M8.5 11h5" />
        </svg>
      </span>
      <strong>{titulo}</strong>
      <p>{descripcion}</p>
      {accion && <div className="empty-state-action">{accion}</div>}
    </div>
  );
}

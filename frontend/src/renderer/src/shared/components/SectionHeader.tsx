import { ReactNode } from "react";

interface SectionHeaderProps {
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}

export default function SectionHeader({ titulo, descripcion, accion }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>{titulo}</h2>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {accion && <div className="section-header-action">{accion}</div>}
    </div>
  );
}

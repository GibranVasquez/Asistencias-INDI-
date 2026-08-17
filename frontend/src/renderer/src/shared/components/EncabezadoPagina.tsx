import { ReactNode } from "react";

interface EncabezadoPaginaProps {
  titulo: string;
  descripcion?: ReactNode;
  metadata?: ReactNode;
  accion?: ReactNode;
}

export default function EncabezadoPagina({ titulo, descripcion, metadata, accion }: EncabezadoPaginaProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <div className="page-header-title-row">
          <h1>{titulo}</h1>
          {metadata && <span className="page-header-metadata">{metadata}</span>}
        </div>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {accion && <div className="page-header-action">{accion}</div>}
    </header>
  );
}

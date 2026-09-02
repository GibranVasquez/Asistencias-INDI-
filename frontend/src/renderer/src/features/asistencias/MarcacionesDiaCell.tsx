import { MarcasPorTipo, TIPOS_MARCACION_OPERATIVOS } from "./listaSemanal";
import { ETIQUETA_TIPO_MARCACION } from "./api";

export interface MarcacionesDiaCellProps {
  fecha: string;
  marcas?: MarcasPorTipo;
  sinClasificar: number;
  onVerSinClasificar?: () => void;
}

/** Celda compacta de un día: conserva todas las horas y no depende del orden. */
export default function MarcacionesDiaCell({ fecha, marcas, sinClasificar, onVerSinClasificar }: MarcacionesDiaCellProps) {
  return (
    <td className="celda-marcaciones-dia">
      <div className="marcaciones-dia-grid" aria-label={`Marcaciones del ${fecha}`}>
        {TIPOS_MARCACION_OPERATIVOS.map((tipo) => {
          const horas = marcas?.[tipo] ?? [];
          if (!horas.length) return null;
          return <div className="marcacion-tipo" key={tipo} title={ETIQUETA_TIPO_MARCACION[tipo]}><span className="marcacion-tipo-etiqueta">{ETIQUETA_TIPO_MARCACION[tipo]}</span><span className="marcacion-tipo-horas">{horas.join(" · ")}</span></div>;
        })}
        {!(marcas && TIPOS_MARCACION_OPERATIVOS.some((tipo) => (marcas[tipo] ?? []).length)) && <span className="sin-marcaciones-dia">Sin marcaciones</span>}
      </div>
      {sinClasificar > 0 && (
        <button type="button" className="sin-clasificar-dia" onClick={onVerSinClasificar}>
          {sinClasificar} sin clasificar
        </button>
      )}
    </td>
  );
}

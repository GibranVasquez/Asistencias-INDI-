import { MarcasPorTipo, TIPOS_MARCACION } from "./listaSemanal";
import { ETIQUETA_TIPO_MARCACION, TipoMarcacion } from "./api";

const ABREVIATURA_TIPO: Record<TipoMarcacion, string> = {
  entrada: "E",
  salida_descanso: "SD",
  entrada_descanso: "ED",
  salida: "S",
  entrada_tiempo_extra: "E.T.E.",
  salida_tiempo_extra: "S.T.E.",
};

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
        {TIPOS_MARCACION.map((tipo) => {
          const horas = marcas?.[tipo] ?? [];
          const etiqueta = ABREVIATURA_TIPO[tipo];
          return (
            <div className="marcacion-tipo" key={tipo} title={ETIQUETA_TIPO_MARCACION[tipo]}>
              <span className="marcacion-tipo-etiqueta" aria-label={ETIQUETA_TIPO_MARCACION[tipo]}>{etiqueta}</span>
              <span className={`marcacion-tipo-horas${horas.length ? "" : " vacio"}`}>{horas.length ? horas.join(" · ") : "—"}</span>
            </div>
          );
        })}
      </div>
      {sinClasificar > 0 && (
        <button type="button" className="sin-clasificar-dia" onClick={onVerSinClasificar}>
          {sinClasificar} sin clasificar
        </button>
      )}
    </td>
  );
}

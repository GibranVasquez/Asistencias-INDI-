import { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode, useRef, useState } from "react";

type VarianteBoton = "solido" | "outline";
type TamanoBoton = "normal" | "pequeno";

interface BotonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  // Acepta tanto un onClick síncrono de siempre (void) como uno que retorna
  // una Promise — en ese segundo caso el botón se auto-deshabilita mientras
  // está pendiente, sin que el caller tenga que declarar su propio useState
  // de "guardando"/"procesando". 100% retrocompatible: un onClick que no
  // retorna Promise se comporta exactamente igual que antes.
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  // Opcional: reemplaza children mientras la promesa está pendiente (ej.
  // "Borrando…"). Si se omite, children se queda igual y solo se gana el
  // disabled automático — así convive sin conflicto con botones que ya
  // arman su propio texto dinámico (ej. NominaPage's "Calculando… X/Y").
  textoEnProceso?: ReactNode;
}

const ESTILO_BASE: CSSProperties = {
  borderRadius: 999,
  fontWeight: 700,
  fontFamily: "inherit",
};

const ESTILO_TAMANO: Record<TamanoBoton, CSSProperties> = {
  normal: { padding: "11px 22px", fontSize: 13.5 },
  pequeno: { padding: "7px 16px", fontSize: 12.5 },
};

const ESTILO_VARIANTE: Record<VarianteBoton, CSSProperties> = {
  solido: { background: "var(--indi)", color: "var(--white)", border: "none" },
  outline: { background: "var(--surface)", color: "var(--ink)", border: "1.5px solid var(--line)" },
};

// Botones pill compartidos (sólido = acción primaria, outline = secundaria) —
// reemplaza los bloques de estilo inline repetidos por pantalla. `style` se
// aplica al final para casos puntuales (flex:1 en modales, color de acento
// distinto para una acción tipo "Desactivar", etc.) sin tener que crear una
// variante nueva por cada uno.
export default function Boton({
  variante = "solido",
  tamano = "normal",
  style,
  disabled,
  onClick,
  textoEnProceso,
  children,
  className,
  ...resto
}: BotonProps) {
  const [enProceso, setEnProceso] = useState(false);
  // Guarda contra un segundo clic en el mismo tick, antes de que el
  // re-render por setEnProceso(true) llegue a aplicar el `disabled` real.
  const enVueloRef = useRef(false);

  async function manejarClick(e: MouseEvent<HTMLButtonElement>) {
    if (!onClick || enVueloRef.current) return;
    const resultado = onClick(e);
    if (resultado instanceof Promise) {
      enVueloRef.current = true;
      setEnProceso(true);
      try {
        await resultado;
      } finally {
        enVueloRef.current = false;
        setEnProceso(false);
      }
    }
  }

  const deshabilitado = disabled || enProceso;

  return (
    <button
      {...resto}
      className={`boton-ui${className ? ` ${className}` : ""}`}
      onClick={manejarClick}
      disabled={deshabilitado}
      aria-busy={enProceso || undefined}
      style={{
        ...ESTILO_BASE,
        ...ESTILO_TAMANO[tamano],
        ...ESTILO_VARIANTE[variante],
        cursor: deshabilitado ? "default" : "pointer",
        opacity: deshabilitado ? 0.7 : 1,
        ...style,
      }}
    >
      {enProceso && textoEnProceso !== undefined ? textoEnProceso : children}
    </button>
  );
}

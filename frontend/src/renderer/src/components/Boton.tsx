import { ButtonHTMLAttributes, CSSProperties } from "react";

type VarianteBoton = "solido" | "outline";
type TamanoBoton = "normal" | "pequeno";

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
}

const ESTILO_BASE: CSSProperties = {
  borderRadius: 999,
  fontWeight: 700,
  fontFamily: "inherit",
  transition: "background .15s ease, color .15s ease, opacity .15s ease",
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
export default function Boton({ variante = "solido", tamano = "normal", style, disabled, ...resto }: BotonProps) {
  return (
    <button
      {...resto}
      disabled={disabled}
      style={{
        ...ESTILO_BASE,
        ...ESTILO_TAMANO[tamano],
        ...ESTILO_VARIANTE[variante],
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    />
  );
}

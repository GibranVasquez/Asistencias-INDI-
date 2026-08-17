import { ReactNode } from "react";

export type ColorChip = "ok" | "warn" | "err" | "indi" | "muted";

// Fondos sólidos verificados con blanco por encima (ver theme.css,
// --chip-*-bg): --ok/--warn/--err a color completo NO pasan 4.5:1 con
// texto/ícono blanco, así que este chip usa versiones oscurecidas
// dedicadas, no los tokens de acento directos. "muted" es para el estado
// "sin dato"/inactivo — fondo neutro, ícono atenuado, no un color de marca.
const FONDOS: Record<ColorChip, string> = {
  ok: "var(--chip-ok-bg)",
  warn: "var(--chip-warn-bg)",
  err: "var(--chip-err-bg)",
  indi: "var(--indi2)",
  muted: "var(--line)",
};

const COLOR_ICONO: Record<ColorChip, string> = {
  ok: "var(--white)",
  warn: "var(--white)",
  err: "var(--white)",
  indi: "var(--white)",
  muted: "var(--muted)",
};

interface ChipEstadoProps {
  icono: ReactNode;
  color: ColorChip;
  tamano?: number;
  titulo?: string;
}

export default function ChipEstado({ icono, color, tamano = 30, titulo }: ChipEstadoProps) {
  return (
    <span
      title={titulo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: tamano,
        height: tamano,
        borderRadius: 10,
        background: FONDOS[color],
        color: COLOR_ICONO[color],
        fontSize: tamano * 0.5,
        lineHeight: 1,
        flexShrink: 0,
        // Emoji a color (👆🙂 etc.) ignoran `color` — son glifos con su
        // propio color nativo, no texto. Sin esto, un ícono emoji en estado
        // "muted" se seguiría viendo a todo color sobre el fondo neutro, sin
        // transmitir "no registrado" como sí lo hacía el opacity:.25 anterior.
        opacity: color === "muted" ? 0.5 : 1,
      }}
    >
      {icono}
    </span>
  );
}

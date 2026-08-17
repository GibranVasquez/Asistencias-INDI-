import { useEffect, useState } from "react";
import { asset } from "@/shared/assets";

// Piezas del logo terminan de ensamblarse ~1.67s (ver theme.css, .il1-.il4),
// el desvanecido (logo + fondo) arranca a los 2.02s y dura ~0.5s -> ~2.52s.
// Este valor deja un margen corto después de eso.
const DURACION_MS = 2800;

export default function IntroSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), DURACION_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div className="intro-veil">
      <div
        className="intro-lock"
        style={{ ["--intro-logo-url" as string]: `url(${asset("assets/indi-logo.png")})` }}
      >
        <i className="il1" />
        <i className="il2" />
        <i className="il3" />
        <i className="il4" />
      </div>
    </div>
  );
}

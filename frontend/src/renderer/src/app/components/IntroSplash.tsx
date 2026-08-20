import { useEffect, useState } from "react";
import { asset } from "@/shared/assets";

// Piezas del logo terminan de ensamblarse ~1.67s (ver theme.css, .il1-.il4),
// el desvanecido (logo + fondo) arranca a los 2.02s y dura ~0.5s -> ~2.52s.
// Este valor deja un margen corto después de eso.
const DURACION_MS = 2800;

export default function IntroSplash() {
  const [visible, setVisible] = useState(true);
  // Un url() guardado en una custom property se resuelve desde la hoja CSS
  // que lo consume, no desde el documento. En el build file:// eso duplicaba
  // el segmento assets/ (assets/assets/indi-logo.png). La URL absoluta evita
  // que cada montaje del splash genere ERR_FILE_NOT_FOUND.
  const logoUrl = new URL(asset("assets/indi-logo.png"), document.baseURI).href;

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), DURACION_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div className="intro-veil">
      <div
        className="intro-lock"
        style={{ ["--intro-logo-url" as string]: `url(${logoUrl})` }}
      >
        <i className="il1" />
        <i className="il2" />
        <i className="il3" />
        <i className="il4" />
      </div>
    </div>
  );
}

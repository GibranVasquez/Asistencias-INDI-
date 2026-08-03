import { useEffect, useState } from "react";
import { asset } from "../assets";

const DURACION_MS = 3300;

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

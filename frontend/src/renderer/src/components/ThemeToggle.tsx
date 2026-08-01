import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ oscuroPorDefecto = false }: { oscuroPorDefecto?: boolean }) {
  const { temaResuelto, cambiarTema } = useTheme();
  const esOscuro = temaResuelto === "oscuro";

  return (
    <button
      type="button"
      onClick={() => cambiarTema(esOscuro ? "claro" : "oscuro")}
      title={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: `1.5px solid ${oscuroPorDefecto ? "rgba(255,255,255,.3)" : "var(--line)"}`,
        background: oscuroPorDefecto ? "rgba(255,255,255,.08)" : "var(--surface)",
        color: oscuroPorDefecto ? "#fff" : "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {esOscuro ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

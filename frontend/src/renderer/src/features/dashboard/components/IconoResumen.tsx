export default function IconoResumen({ tipo }: { tipo: string }) {
  const comunes = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (tipo === "puntualidad") return <svg {...comunes}><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  if (tipo === "tardanza") return <svg {...comunes}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
  if (tipo === "ausencia") return <svg {...comunes}><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-5 9c0-3 2-5 5-5 1.2 0 2.3.3 3.1.9M16 14l5 5m0-5-5 5" /></svg>;
  if (tipo === "usuarios") return <svg {...comunes}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2.4-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6m1 3c2.4.5 4 2.4 4 5" /></svg>;
  if (tipo === "terminal") return <svg {...comunes}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M10 17h4" /></svg>;
  if (tipo === "agregar") return <svg {...comunes}><circle cx="12" cy="12" r="8" /><path d="M12 8v8m-4-4h8" /></svg>;
  if (tipo === "nomina") return <svg {...comunes}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18m-5 4h2" /></svg>;
  if (tipo === "reporte") return <svg {...comunes}><path d="M5 20V10m7 10V4m7 16v-7" /></svg>;
  return <svg {...comunes}><path d="M5 12h14M12 5v14" /><circle cx="12" cy="12" r="9" /></svg>;
}

import { Link } from "react-router-dom";
import { RutaPanel } from "@/routes/navigationConfig";
import IconoResumen from "@/features/dashboard/components/IconoResumen";

export default function PanelAccionesRapidas({ rol, ruta }: { rol: string; ruta: (id: RutaPanel) => string }) {
  const acciones = rol === "administrador"
    ? [{ titulo: "Usuarios", detalle: "Administrar accesos", ruta: ruta("usuarios"), icono: "usuarios" }, { titulo: "Terminales", detalle: "Gestionar dispositivos", ruta: ruta("terminales"), icono: "terminal" }]
    : [{ titulo: "Nuevo trabajador", detalle: "Registrar personal", ruta: "/panel/trabajadores/nuevo", icono: "agregar" }, { titulo: "Asistencias", detalle: "Revisar marcaciones", ruta: ruta("asistencias"), icono: "asistencia" }, { titulo: "Nómina", detalle: "Preparar semana", ruta: ruta("nomina"), icono: "nomina" }, { titulo: "Reportes", detalle: "Consultar resultados", ruta: ruta("reportes"), icono: "reporte" }];
  return <section className="quick-actions" aria-labelledby="acciones-rapidas-titulo"><h2 id="acciones-rapidas-titulo" className="section-heading">Acciones rápidas</h2><div className="quick-actions-grid">{acciones.map((accion) => <Link className="quick-action" to={accion.ruta} key={accion.ruta} aria-label={`Acción rápida: ${accion.detalle}`}><span className="quick-action-icon" aria-hidden="true"><IconoResumen tipo={accion.icono} /></span><span className="quick-action-copy"><strong>{accion.titulo}</strong><span>{accion.detalle}</span></span><span className="quick-action-arrow" aria-hidden="true">›</span></Link>)}</div></section>;
}

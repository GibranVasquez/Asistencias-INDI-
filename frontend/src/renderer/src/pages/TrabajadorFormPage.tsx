import { CSSProperties, ReactNode, SubmitEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  crearTrabajador,
  DatosTrabajador,
  editarTrabajador,
  obtenerTrabajador,
  Trabajador,
  TrabajadorEstatus,
  TrabajadorTipo,
} from "../api/trabajadores";
import { useAuth } from "../context/AuthContext";
import { CategoriaTrabajador, listarCategoriasTrabajador } from "../api/categoriasTrabajador";
import Boton from "../components/Boton";
import CampoFecha from "../components/CampoFecha";

interface FormularioEstado {
  nombreCompleto: string;
  categoria: string;
  jefeInmediato: string;
  tipo: TrabajadorTipo;
  estatus: TrabajadorEstatus;
  fechaIngreso: string;
  sueldoBase: string;
  banco: string;
  clabe: string;
  cuentaBancaria: string;
  infonavitPlazoMeses: string;
  infonavitMontoPorPeriodo: string;
  huellaRegistrada: boolean;
  rostroRegistrado: boolean;
  numeroChecador: string;
}

const FORMULARIO_VACIO: FormularioEstado = {
  nombreCompleto: "",
  categoria: "",
  jefeInmediato: "",
  tipo: "empleado",
  estatus: "activo",
  fechaIngreso: "",
  sueldoBase: "",
  banco: "",
  clabe: "",
  cuentaBancaria: "",
  infonavitPlazoMeses: "",
  infonavitMontoPorPeriodo: "",
  huellaRegistrada: false,
  rostroRegistrado: false,
  numeroChecador: "",
};

function trabajadorAFormulario(t: Trabajador): FormularioEstado {
  return {
    nombreCompleto: t.nombreCompleto,
    categoria: t.categoria,
    jefeInmediato: t.jefeInmediato,
    tipo: t.tipo,
    estatus: t.estatus,
    fechaIngreso: t.fechaIngreso?.slice(0, 10) ?? "",
    sueldoBase: t.sueldoBase ?? "",
    banco: t.banco ?? "",
    clabe: t.clabe ?? "",
    cuentaBancaria: t.cuentaBancaria ?? "",
    infonavitPlazoMeses: t.infonavitPlazoMeses?.toString() ?? "",
    infonavitMontoPorPeriodo: t.infonavitMontoPorPeriodo ?? "",
    huellaRegistrada: t.huellaRegistrada,
    rostroRegistrado: t.rostroRegistrado,
    numeroChecador: t.numeroChecador?.toString() ?? "",
  };
}

function formularioADatos(f: FormularioEstado): DatosTrabajador {
  return {
    nombreCompleto: f.nombreCompleto.trim(),
    categoria: f.categoria.trim(),
    jefeInmediato: f.jefeInmediato.trim(),
    tipo: f.tipo,
    estatus: f.estatus,
    fechaIngreso: f.fechaIngreso || null,
    sueldoBase: f.sueldoBase !== "" ? Number(f.sueldoBase) : null,
    banco: f.banco.trim() || null,
    clabe: f.clabe.trim() || null,
    cuentaBancaria: f.cuentaBancaria.trim() || null,
    infonavitPlazoMeses: f.infonavitPlazoMeses !== "" ? Number(f.infonavitPlazoMeses) : null,
    infonavitMontoPorPeriodo: f.infonavitMontoPorPeriodo !== "" ? Number(f.infonavitMontoPorPeriodo) : null,
    huellaRegistrada: f.huellaRegistrada,
    rostroRegistrado: f.rostroRegistrado,
    numeroChecador: f.numeroChecador !== "" ? Number(f.numeroChecador) : null,
  };
}

const estiloEtiqueta: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--muted)" };
const estiloInput: CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--line)", fontSize: 13.5, background: "var(--surface)", color: "var(--ink)" };

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px", marginTop: 16 }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{titulo}</h3>
      {nota && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, marginBottom: 12 }}>{nota}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: nota ? 0 : 12 }}>
        {children}
      </div>
    </div>
  );
}

export default function TrabajadorFormPage() {
  const { id } = useParams<{ id?: string }>();
  const esEdicion = Boolean(id);
  const { sesion } = useAuth();
  const token = sesion!.token;
  const navegar = useNavigate();

  const [form, setForm] = useState<FormularioEstado>(FORMULARIO_VACIO);
  const [cargando, setCargando] = useState(esEdicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaTrabajador[] | null>(null);

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    obtenerTrabajador(token, id)
      .then((r) => setForm(trabajadorAFormulario(r.trabajador)))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor."))
      .finally(() => setCargando(false));
  }, [id, token]);

  // Solo al dar de alta (no al editar, donde categoria/sueldoBase ya son
  // datos reales del trabajador) — el catálogo solo sirve para prellenar,
  // ver config/CategoriaTrabajador en ConfiguracionPage.tsx.
  useEffect(() => {
    if (esEdicion) return;
    listarCategoriasTrabajador(token)
      .then((r) => {
        setCategorias(r.categorias);
        // "Sueldo fijo para todos": si hay una categoría marcada esDefault,
        // se usa como sueldo sugerido desde el inicio, sin que el usuario
        // tenga que elegir nada — sigue siendo editable antes de guardar.
        const porDefecto = r.categorias.find((c) => c.esDefault);
        if (porDefecto?.sueldoBaseDefault) {
          setForm((f) => (f.sueldoBase === "" ? { ...f, sueldoBase: porDefecto.sueldoBaseDefault as string } : f));
        }
      })
      .catch(() => setCategorias([]));
  }, [esEdicion, token]);

  function seleccionarCategoriaCatalogo(nombreCategoria: string) {
    const categoria = categorias?.find((c) => c.nombre === nombreCategoria);
    if (!categoria) return;
    setForm((f) => ({
      ...f,
      categoria: categoria.nombre,
      sueldoBase: categoria.sueldoBaseDefault ?? f.sueldoBase,
    }));
  }

  function actualizar<K extends keyof FormularioEstado>(campo: K, valor: FormularioEstado[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(evento: SubmitEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const datos = formularioADatos(form);
      if (esEdicion && id) {
        await editarTrabajador(token, id, datos);
      } else {
        await crearTrabajador(token, datos);
      }
      navegar("/panel/trabajadores");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <div style={{ padding: "26px 30px 60px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navegar("/panel/trabajadores")}
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}
        >
          ← Trabajadores
        </button>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 8 }}>
        {esEdicion ? form.nombreCompleto || "Editar trabajador" : "Nuevo trabajador"}
      </h1>

      <form onSubmit={manejarEnvio}>
        <Seccion titulo="Datos generales">
          <label style={estiloEtiqueta}>
            Nombre completo
            <input required value={form.nombreCompleto} onChange={(e) => actualizar("nombreCompleto", e.target.value)} style={estiloInput} />
          </label>
          <label style={estiloEtiqueta}>
            Categoría
            <input required value={form.categoria} onChange={(e) => actualizar("categoria", e.target.value)} style={estiloInput} />
          </label>
          {!esEdicion && categorias && categorias.length > 0 && (
            <label style={estiloEtiqueta}>
              Usar categoría del catálogo (opcional)
              <select defaultValue="" onChange={(e) => seleccionarCategoriaCatalogo(e.target.value)} style={estiloInput}>
                <option value="" disabled>
                  Elegir para prellenar sueldo…
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
                Solo prellena Categoría y Sueldo base arriba — ambos siguen editables.
              </span>
            </label>
          )}
          <label style={estiloEtiqueta}>
            Jefe inmediato
            <input required value={form.jefeInmediato} onChange={(e) => actualizar("jefeInmediato", e.target.value)} style={estiloInput} />
          </label>
          <label style={estiloEtiqueta}>
            Tipo
            <select value={form.tipo} onChange={(e) => actualizar("tipo", e.target.value as TrabajadorTipo)} style={estiloInput}>
              <option value="empleado">Empleado</option>
              <option value="contratista">Contratista</option>
              <option value="becario">Becario</option>
            </select>
          </label>
          {esEdicion && (
            <label style={estiloEtiqueta}>
              Estatus
              <select value={form.estatus} onChange={(e) => actualizar("estatus", e.target.value as TrabajadorEstatus)} style={estiloInput}>
                <option value="activo">Activo</option>
                <option value="baja">Baja</option>
              </select>
            </label>
          )}
        </Seccion>

        <Seccion
          titulo="Nómina"
          nota="El roster de enrolamiento biométrico no trajo estos datos para varios trabajadores — completar aquí cuando RH los tenga."
        >
          <label style={estiloEtiqueta}>
            Fecha de ingreso
            <CampoFecha value={form.fechaIngreso} onChange={(e) => actualizar("fechaIngreso", e.target.value)} />
          </label>
          <label style={estiloEtiqueta}>
            Sueldo base
            <input type="number" min={0} step="0.01" value={form.sueldoBase} onChange={(e) => actualizar("sueldoBase", e.target.value)} style={estiloInput} />
          </label>
          <label style={estiloEtiqueta}>
            Banco
            <input value={form.banco} onChange={(e) => actualizar("banco", e.target.value)} style={estiloInput} />
          </label>
          <label style={estiloEtiqueta}>
            CLABE
            <input value={form.clabe} onChange={(e) => actualizar("clabe", e.target.value)} style={estiloInput} />
          </label>
          <label style={estiloEtiqueta}>
            Cuenta bancaria
            <input value={form.cuentaBancaria} onChange={(e) => actualizar("cuentaBancaria", e.target.value)} style={estiloInput} />
          </label>
        </Seccion>

        <Seccion titulo="INFONAVIT">
          <label style={estiloEtiqueta}>
            Plazo (meses)
            <input type="number" min={0} step={1} value={form.infonavitPlazoMeses} onChange={(e) => actualizar("infonavitPlazoMeses", e.target.value)} style={estiloInput} />
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              Solo informativo — no se usa para calcular nada.
            </span>
          </label>
          <label style={estiloEtiqueta}>
            Monto por periodo
            <input type="number" min={0} step="0.01" value={form.infonavitMontoPorPeriodo} onChange={(e) => actualizar("infonavitMontoPorPeriodo", e.target.value)} style={estiloInput} />
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              Monto real que la nómina descuenta tal cual.
            </span>
          </label>
        </Seccion>

        <Seccion titulo="Biometría">
          <label style={estiloEtiqueta}>
            Número de checador (PIN ADMS)
            <input
              type="number"
              min={0}
              step={1}
              value={form.numeroChecador}
              onChange={(e) => actualizar("numeroChecador", e.target.value)}
              style={estiloInput}
            />
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              PIN con el que se enroló en el lector ADMS de oficina (ZKTeco MB10-VL).
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink)" }}>
            <input type="checkbox" checked={form.huellaRegistrada} onChange={(e) => actualizar("huellaRegistrada", e.target.checked)} style={{ width: 16, height: 16 }} />
            Huella registrada
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ink)" }}>
            <input type="checkbox" checked={form.rostroRegistrado} onChange={(e) => actualizar("rostroRegistrado", e.target.checked)} style={{ width: 16, height: 16 }} />
            Rostro registrado
          </label>
        </Seccion>

        {error && (
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--err)", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.25)", borderRadius: 8, padding: "10px 12px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Boton type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear trabajador"}
          </Boton>
          <Boton variante="outline" type="button" onClick={() => navegar("/panel/trabajadores")}>
            Cancelar
          </Boton>
        </div>
      </form>
    </div>
  );
}

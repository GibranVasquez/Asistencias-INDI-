import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  aplicarSueldoATrabajadores,
  listarTrabajadores,
  Trabajador,
  tieneDatosNominaIncompletos,
} from "../api/trabajadores";
import { useAuth } from "../context/AuthContext";
import Boton from "../components/Boton";
import ChipEstado from "../components/ChipEstado";
import ModalConfirmacion from "../components/ModalConfirmacion";

const ETIQUETA_TIPO: Record<string, string> = { empleado: "Empleado", contratista: "Contratista", becario: "Becario" };

export default function TrabajadoresPage() {
  const { sesion } = useAuth();
  const token = sesion!.token;
  const navegar = useNavigate();

  const [trabajadores, setTrabajadores] = useState<Trabajador[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const [nuevoSueldo, setNuevoSueldo] = useState("");
  const [confirmandoSueldo, setConfirmandoSueldo] = useState(false);
  const [errorAplicar, setErrorAplicar] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await listarTrabajadores(token);
      setTrabajadores(respuesta.trabajadores);
      const idsActivos = new Set(respuesta.trabajadores.filter((t) => t.estatus === "activo").map((t) => t.id));
      setSeleccionados((actuales) => new Set([...actuales].filter((id) => idsActivos.has(id))));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const categorias = useMemo(() => {
    if (!trabajadores) return [];
    return Array.from(new Set(trabajadores.map((t) => t.categoria))).sort((a, b) => a.localeCompare(b));
  }, [trabajadores]);

  const filtrados = useMemo(() => {
    if (!trabajadores) return [];
    const q = busqueda.trim().toLowerCase();
    return trabajadores.filter(
      (t) =>
        (!categoriaFiltro || t.categoria === categoriaFiltro) &&
        (!q || t.nombreCompleto.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q))
    );
  }, [trabajadores, busqueda, categoriaFiltro]);

  const incompletos = trabajadores?.filter(tieneDatosNominaIncompletos).length ?? 0;
  const activosFiltrados = filtrados.filter((t) => t.estatus === "activo");
  const todosActivosFiltradosSeleccionados =
    activosFiltrados.length > 0 && activosFiltrados.every((t) => seleccionados.has(t.id));
  const sueldoNumero = Number(nuevoSueldo);
  const sueldoValido = nuevoSueldo.trim() !== "" && Number.isFinite(sueldoNumero) && sueldoNumero >= 0;

  function alternarSeleccion(id: string) {
    setSeleccionados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
    setMensajeExito(null);
  }

  function alternarActivosFiltrados() {
    setSeleccionados((actuales) => {
      const siguientes = new Set(actuales);
      if (todosActivosFiltradosSeleccionados) {
        activosFiltrados.forEach((t) => siguientes.delete(t.id));
      } else {
        activosFiltrados.forEach((t) => siguientes.add(t.id));
      }
      return siguientes;
    });
    setMensajeExito(null);
  }

  async function confirmarAplicarSueldo(): Promise<void> {
    setErrorAplicar(null);
    try {
      const resultado = await aplicarSueldoATrabajadores(token, [...seleccionados], sueldoNumero);
      await cargar();
      setSeleccionados(new Set());
      setNuevoSueldo("");
      setConfirmandoSueldo(false);
      setMensajeExito(
        `Sueldo aplicado correctamente a ${resultado.afectados} trabajador${resultado.afectados === 1 ? "" : "es"}.`
      );
    } catch (err) {
      setErrorAplicar(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
      throw err;
    }
  }

  return (
    <div style={{ padding: "26px 30px 36px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>Trabajadores</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            {trabajadores ? `${trabajadores.length} en total` : "Cargando…"}
            {incompletos > 0 && (
              <span style={{ color: "var(--warn)", fontWeight: 600 }}> · {incompletos} con datos de nómina incompletos</span>
            )}
          </p>
        </div>
        <Boton onClick={() => navegar("/panel/trabajadores/nuevo")}>+ Nuevo trabajador</Boton>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por nombre o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "10px 14px",
            borderRadius: 9,
            border: "1.5px solid var(--line)",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 9,
            border: "1.5px solid var(--line)",
            fontSize: 13.5,
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
        }}
      >
        <strong style={{ color: "var(--ink)", fontSize: 13.5 }}>
          {seleccionados.size} trabajador{seleccionados.size === 1 ? "" : "es"} seleccionado{seleccionados.size === 1 ? "" : "s"}
        </strong>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
          Nuevo sueldo base
          <input
            type="number"
            min="0"
            step="0.01"
            value={nuevoSueldo}
            onChange={(e) => {
              setNuevoSueldo(e.target.value);
              setErrorAplicar(null);
              setMensajeExito(null);
            }}
            placeholder="0.00"
            style={{ width: 130, padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)" }}
          />
        </label>
        <Boton
          tamano="pequeno"
          disabled={seleccionados.size === 0 || !sueldoValido}
          onClick={() => {
            setErrorAplicar(null);
            setConfirmandoSueldo(true);
          }}
        >
          Aplicar sueldo
        </Boton>
        {seleccionados.size > 0 && (
          <Boton tamano="pequeno" variante="outline" onClick={() => setSeleccionados(new Set())}>
            Limpiar selección
          </Boton>
        )}
        {mensajeExito && <span style={{ color: "var(--ok)", fontSize: 13, fontWeight: 600 }}>{mensajeExito}</span>}
      </div>

      <div className="tarjeta-admin" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 16, overflow: "hidden" }}>
        {error ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--err)", fontSize: 13.5 }}>{error}</div>
        ) : cargando ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Sin resultados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "10px 12px 10px 20px", width: 40 }}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar trabajadores activos visibles"
                      checked={todosActivosFiltradosSeleccionados}
                      disabled={activosFiltrados.length === 0}
                      onChange={alternarActivosFiltrados}
                      style={{ width: 16, height: 16, accentColor: "var(--indi2)" }}
                    />
                  </th>
                  <th style={{ padding: "10px 20px" }}>Nombre</th>
                  <th style={{ padding: "10px 12px" }}>Categoría</th>
                  <th style={{ padding: "10px 12px" }}>Tipo</th>
                  <th style={{ padding: "10px 12px" }}>Estatus</th>
                  <th style={{ padding: "10px 12px" }}>Biometría</th>
                  <th style={{ padding: "10px 20px" }}>Nómina</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navegar(`/panel/trabajadores/${t.id}`)}
                    style={{
                      borderTop: "1px solid var(--line)",
                      fontSize: 13.5,
                      cursor: "pointer",
                      background: seleccionados.has(t.id) ? "color-mix(in srgb, var(--indi2) 8%, var(--surface))" : undefined,
                    }}
                  >
                    <td style={{ padding: "11px 12px 11px 20px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${t.nombreCompleto}`}
                        checked={seleccionados.has(t.id)}
                        disabled={t.estatus !== "activo"}
                        title={t.estatus !== "activo" ? "Solo se puede aplicar sueldo a trabajadores activos" : undefined}
                        onChange={() => alternarSeleccion(t.id)}
                        style={{ width: 16, height: 16, accentColor: "var(--indi2)" }}
                      />
                    </td>
                    <td style={{ padding: "11px 20px", fontWeight: 600, color: "var(--ink)" }}>{t.nombreCompleto}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{t.categoria}</td>
                    <td style={{ padding: "11px 12px", color: "var(--muted)" }}>{ETIQUETA_TIPO[t.tipo] ?? t.tipo}</td>
                    <td style={{ padding: "11px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ChipEstado
                          tamano={24}
                          color={t.estatus === "activo" ? "ok" : "err"}
                          icono={t.estatus === "activo" ? "✓" : "✕"}
                        />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.estatus === "activo" ? "var(--ok)" : "var(--err)" }}>
                          {t.estatus === "activo" ? "Activo" : "Baja"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ChipEstado tamano={24} color={t.huellaRegistrada ? "ok" : "muted"} icono="👆" titulo="Huella" />
                        <ChipEstado tamano={24} color={t.rostroRegistrado ? "ok" : "muted"} icono="🙂" titulo="Rostro" />
                      </div>
                    </td>
                    <td style={{ padding: "11px 20px" }}>
                      {tieneDatosNominaIncompletos(t) ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--warn)",
                            background: "color-mix(in srgb, var(--warn) 14%, transparent)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          Incompleta
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--ok)",
                            background: "color-mix(in srgb, var(--ok) 12%, transparent)",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          Completa
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmandoSueldo && (
        <ModalConfirmacion
          titulo="Aplicar sueldo a trabajadores seleccionados"
          mensaje={
            <>
              Se asignará un sueldo base de <strong>${sueldoNumero.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> a
              {" "}<strong>{seleccionados.size} trabajador{seleccionados.size === 1 ? "" : "es"}</strong>.
              Las nóminas históricas no se modificarán.
              {errorAplicar && <div style={{ color: "var(--err)", marginTop: 10, fontWeight: 600 }}>{errorAplicar}</div>}
            </>
          }
          etiquetaConfirmar={`Aplicar a ${seleccionados.size}`}
          peligroso={false}
          onConfirmar={confirmarAplicarSueldo}
          onCancelar={() => {
            setConfirmandoSueldo(false);
            setErrorAplicar(null);
          }}
        />
      )}
    </div>
  );
}

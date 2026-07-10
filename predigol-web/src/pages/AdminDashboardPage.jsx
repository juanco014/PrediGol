import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  activarPremiumManualAdmin,
  obtenerDatasetsAdmin,
  obtenerModelRunsAdmin,
  obtenerPrediccionesAdmin,
  obtenerResumenAdmin,
  obtenerUsuariosPremiumAdmin,
} from "../services/adminApi";
import { useProfile } from "../hooks/useProfile";
import { isAdminUser } from "../utils/admin";

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fecha));
}

function formatearPorcentaje(valor) {
  if (valor === null || valor === undefined) return "N/D";
  return `${Math.round(Number(valor) * 100)}%`;
}

const comandosOperativos = [
  { label: "Importar ligas/temporadas", command: "./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 140 --seasons 2022 --dry-run" },
  { label: "Generar pronósticos V1", command: "./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-140_temporada-2022_dataset.json --model v1" },
  { label: "Backtest comparativo", command: "./prediction-service/.venv/Scripts/python.exe scripts/backtest_v1_v2.py --dataset-glob \"reports/*_dataset.json\" --min-training 30" },
  { label: "Verificar Python", command: "./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py" },
];

function AdminDashboardPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const { profile, loadingProfile } = useProfile(usuarioId);
  const esAdmin = isAdminUser(profile);
  const [resumen, setResumen] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [predicciones, setPredicciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [activando, setActivando] = useState(false);
  const [filtros, setFiltros] = useState({ liga: "", fecha: "", modelo: "", accessTier: "" });
  const [premiumForm, setPremiumForm] = useState({ userId: "", days: "30", note: "" });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setMensaje("");
    try {
      const [resumenData, datasetsData, runsData, prediccionesData, usuariosData] = await Promise.all([
        obtenerResumenAdmin(),
        obtenerDatasetsAdmin(),
        obtenerModelRunsAdmin(),
        obtenerPrediccionesAdmin(),
        obtenerUsuariosPremiumAdmin(),
      ]);
      setResumen(resumenData);
      setDatasets(datasetsData);
      setRuns(runsData);
      setPredicciones(prediccionesData);
      setUsuarios(usuariosData);
      if (resumenData.errors.length > 0) {
        setMensaje(`Advertencias de carga: ${resumenData.errors.join(" | ")}`);
      }
    } catch (error) {
      setMensaje(error?.message || "No fue posible cargar el panel admin. Verifica rol y RLS.");
      setResumen(null);
      setDatasets([]);
      setRuns([]);
      setPredicciones([]);
      setUsuarios([]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!loadingProfile && esAdmin) {
      const temporizador = window.setTimeout(() => {
        cargarDatos();
      }, 0);
      return () => window.clearTimeout(temporizador);
    }
    return undefined;
  }, [loadingProfile, esAdmin, cargarDatos]);

  const prediccionesFiltradas = useMemo(() => {
    return predicciones.filter((prediccion) => {
      const matchesLeague = !filtros.liga || prediccion.league.toLowerCase().includes(filtros.liga.toLowerCase());
      const matchesDate = !filtros.fecha || String(prediccion.date || "").startsWith(filtros.fecha);
      const matchesModel = !filtros.modelo || prediccion.modelVersion === filtros.modelo;
      const matchesTier = !filtros.accessTier || prediccion.accessTier === filtros.accessTier;
      return matchesLeague && matchesDate && matchesModel && matchesTier;
    });
  }, [filtros, predicciones]);

  const modelos = [...new Set(predicciones.map((prediccion) => prediccion.modelVersion).filter(Boolean))];
  const usuariosPremium = usuarios.filter((usuario) => usuario.isPremium);
  const usuariosFree = usuarios.filter((usuario) => !usuario.isPremium);

  const mostrarComando = async (command) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
      setMensaje(`Comando copiado: ${command}`);
      return;
    }
    setMensaje(`Ejecuta en la raíz del proyecto: ${command}`);
  };

  const activarPremium = async (event) => {
    event.preventDefault();
    const usuario = usuarios.find((item) => item.userId === premiumForm.userId);
    if (!usuario) {
      setMensaje("Selecciona un usuario válido.");
      return;
    }
    if (!window.confirm(`¿Confirmas activar premium manual a ${usuario.name}?`)) return;
    setActivando(true);
    try {
      await activarPremiumManualAdmin({ userId: premiumForm.userId, days: premiumForm.days, note: premiumForm.note });
      setMensaje("Premium manual activado. Esta gestión es temporal hasta pagos reales.");
      setPremiumForm({ userId: "", days: "30", note: "" });
      await cargarDatos();
    } catch (error) {
      setMensaje(error?.message || "No fue posible activar premium manual. Revisa RLS o suscripción activa existente.");
    }
    setActivando(false);
  };

  if (!session?.user) {
    return <main className="admin-page"><section className="empty-league-card"><p>Debes iniciar sesión como administrador para ver este panel.</p></section></main>;
  }

  if (loadingProfile || cargando) {
    return <main className="admin-page"><section className="empty-league-card"><p>Cargando panel administrativo...</p></section></main>;
  }

  if (!esAdmin) {
    return <main className="admin-page"><section className="empty-league-card"><p>Acceso denegado. Tu usuario no tiene rol de administrador.</p></section></main>;
  }

  return (
    <main className="admin-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/perfil")}>
        <ArrowLeft size={19} /> Volver
      </button>

      <header className="admin-header admin-dashboard-hero">
        <div>
          <p className="brand">PREDIGOL ADMIN</p>
          <h1>Estado operativo</h1>
          <p>Panel de revisión para operar PrediGol sin tocar modelos, defaults ni pagos reales.</p>
        </div>
        <button type="button" onClick={cargarDatos}><RefreshCw size={17} />Actualizar</button>
      </header>

      {mensaje && <p className="prediction-message">{mensaje}</p>}

      <section className="admin-data-health-card">
        <div className="admin-data-health-header">
          <div><p className="section-label">SISTEMA</p><h2>Resumen MVP</h2></div>
          <ShieldCheck size={24} />
        </div>
        <div className="admin-data-health-grid admin-dashboard-grid">
          <span><b>Modelo principal</b>{resumen?.model.productionLabel || "V1"} · {resumen?.model.production || "poisson-elo-v1"}</span>
          <span><b>V2</b>{resumen?.model.experimentalLabel || "V2"} · experimental</span>
          <span><b>Predicciones</b>{resumen?.counts.predictions ?? 0}</span>
          <span><b>Datasets</b>{resumen?.counts.datasets ?? datasets.length}</span>
          <span><b>Model runs</b>{resumen?.counts.modelRuns ?? runs.length}</span>
          <span><b>Partidos próximos</b>{resumen?.counts.upcomingMatches ?? 0}</span>
          <span><b>Usuarios premium</b>{resumen?.counts.premiumUsers ?? usuariosPremium.length}</span>
          <span><b>Usuarios gratis</b>{resumen?.counts.freeUsers ?? usuariosFree.length}</span>
        </div>
        <div className="admin-warning-list">
          {(resumen?.warnings || []).map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      </section>

      <section className="admin-import-panel">
        <div><p className="section-label">ACCIONES SEGURAS</p><h2>Comandos sugeridos</h2><span>El frontend no ejecuta scripts locales. Copia y ejecuta desde la raíz del repo.</span></div>
        <div className="admin-import-actions">
          {comandosOperativos.map((item) => (
            <button type="button" key={item.label} onClick={() => mostrarComando(item.command)}><Copy size={16} />{item.label}</button>
          ))}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">DATASETS</p><h2>Disponibles</h2></div><button type="button" onClick={() => navigate("/admin/modelo")}>Ver modelo</button></div>
        <div className="admin-api-runs admin-dashboard-list">
          {datasets.length === 0 ? <p className="admin-data-health-note">No hay datasets en Supabase. Si solo existen archivos en reports/, el frontend no puede leerlos sin API/backend.</p> : datasets.slice(0, 8).map((dataset) => (
            <article className="admin-api-run" key={dataset.id}><div><strong>{dataset.name}</strong><span>{dataset.id}</span></div><span>{dataset.league}</span><span>{dataset.season}</span><span>{dataset.source}</span><span>{dataset.validMatches}/{dataset.totalMatches} válidos</span><span>{dataset.status}</span><small>Creado: {formatearFecha(dataset.createdAt)}</small></article>
          ))}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">MODEL RUNS</p><h2>Últimas ejecuciones</h2></div></div>
        <div className="admin-api-runs admin-dashboard-list">
          {runs.length === 0 ? <p className="admin-data-health-note">No hay model_runs registrados.</p> : runs.slice(0, 8).map((run) => (
            <article className="admin-api-run" key={run.id}><div><strong>{run.modelVersion}</strong><span>{formatearFecha(run.createdAt)}</span></div><span>{run.runType}</span><span>{run.status}</span><span>Dataset {run.datasetId || "N/D"}</span><span>{run.usedMatches}/{run.availableMatches} usados</span><span>Brier {run.brierScore ?? "N/D"}</span>{run.errorDetail && <small>{run.errorDetail}</small>}{run.warnings[0] && <small>{run.warnings[0]}</small>}</article>
          ))}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">PREDICCIONES</p><h2>Revisión admin</h2></div></div>
        <div className="admin-filter-panel">
          <label>Liga<input value={filtros.liga} onChange={(event) => setFiltros((actual) => ({ ...actual, liga: event.target.value }))} placeholder="LaLiga" /></label>
          <label>Fecha<input type="date" value={filtros.fecha} onChange={(event) => setFiltros((actual) => ({ ...actual, fecha: event.target.value }))} /></label>
          <select value={filtros.modelo} onChange={(event) => setFiltros((actual) => ({ ...actual, modelo: event.target.value }))}><option value="">Modelo</option>{modelos.map((modelo) => <option key={modelo}>{modelo}</option>)}</select>
          <select value={filtros.accessTier} onChange={(event) => setFiltros((actual) => ({ ...actual, accessTier: event.target.value }))}><option value="">Gratis/Premium</option><option value="free">Gratis</option><option value="premium">Premium</option></select>
        </div>
        <div className="admin-api-runs admin-dashboard-list">
          {prediccionesFiltradas.length === 0 ? <p className="admin-data-health-note">No hay predicciones para los filtros seleccionados.</p> : prediccionesFiltradas.slice(0, 30).map((prediccion) => (
            <article className="admin-api-run admin-prediction-row" key={prediccion.apiFootballFixtureId}><div><strong>{prediccion.home} vs {prediccion.away}</strong><span>{prediccion.league} · {formatearFecha(prediccion.date)}</span></div><span>{prediccion.modelVersion}</span><span>{prediccion.accessTier === "premium" ? "Premium" : "Gratis"}</span><span>{formatearPorcentaje(prediccion.homeProbability)} / {formatearPorcentaje(prediccion.drawProbability)} / {formatearPorcentaje(prediccion.awayProbability)}</span><span>{prediccion.predictedOutcomeLabel}</span><span>{prediccion.probableScore}</span><span>Conf. {formatearPorcentaje(prediccion.confidence)}</span><small>Generado: {formatearFecha(prediccion.generatedAt)}{prediccion.premiumReason ? ` · ${prediccion.premiumReason}` : ""}</small></article>
          ))}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">PREMIUM</p><h2>Usuarios y plan</h2></div></div>
        <form className="admin-form admin-premium-form" onSubmit={activarPremium}>
          <label>Usuario<select value={premiumForm.userId} onChange={(event) => setPremiumForm((actual) => ({ ...actual, userId: event.target.value }))}><option value="">Selecciona usuario</option>{usuarios.map((usuario) => <option value={usuario.userId} key={usuario.userId}>{usuario.name} · {usuario.status}</option>)}</select></label>
          <label>Días<input type="number" min="1" max="365" value={premiumForm.days} onChange={(event) => setPremiumForm((actual) => ({ ...actual, days: event.target.value }))} /></label>
          <label>Nota<input value={premiumForm.note} onChange={(event) => setPremiumForm((actual) => ({ ...actual, note: event.target.value }))} placeholder="Activación manual MVP" /></label>
          <button type="submit" disabled={activando}>{activando ? "Activando..." : "Activar premium manual"}</button>
        </form>
        <div className="admin-api-runs admin-dashboard-list">
          {usuarios.length === 0 ? <p className="admin-data-health-note">No hay usuarios visibles por RLS o aún no existen perfiles.</p> : usuarios.slice(0, 20).map((usuario) => (
            <article className="admin-api-run" key={usuario.userId}><div><strong>{usuario.name}</strong><span>{usuario.userId}</span></div><span>{usuario.role}</span><span>{usuario.isPremium ? "Premium" : "Gratis"}</span><span>{usuario.status}</span><span>Expira {formatearFecha(usuario.expiresAt)}</span><span>{usuario.source}</span></article>
          ))}
        </div>
      </section>

      <section className="admin-import-panel">
        <div><p className="section-label">RUTAS ADMIN</p><h2>Paneles disponibles</h2><span>/admin es operación general; /admin/modelo mantiene trazabilidad de modelo; /admin/partidos opera importación y estado de partidos.</span></div>
        <div className="admin-import-actions">
          <button type="button" onClick={() => navigate("/admin/modelo")}>Modelo y datasets</button>
          <button type="button" onClick={() => navigate("/admin/partidos")}>Partidos</button>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboardPage;

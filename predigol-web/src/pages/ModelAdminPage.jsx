import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Save, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";
import { isAdminUser } from "../utils/admin";

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fecha));
}

function normalizarClave(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.&,+()[\]{}'`´’\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ModelAdminPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const { profile, loadingProfile } = useProfile(usuarioId);
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [apiMonitor, setApiMonitor] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [filtros, setFiltros] = useState({ modelo: "", tipo: "", estado: "", busqueda: "" });
  const [aliasForm, setAliasForm] = useState({ canonical: "", alias: "", tournament: "", country: "", notes: "" });
  const [apiForm, setApiForm] = useState({ liga: "239", temporada: "2026" });
  const [guardando, setGuardando] = useState(false);
  const esAdmin = isAdminUser(profile);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [summaryResp, runsResp, datasetsResp, aliasesResp, apiMonitorResp] = await Promise.all([
        supabase.rpc("obtener_model_admin_summary"),
        supabase
          .from("model_runs")
          .select("id,created_at,model_version,run_type,status,started_at,finished_at,dataset_id,available_matches,used_matches,discarded_matches,metrics,warnings,error_detail,model_config")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("model_datasets")
          .select("id,created_at,updated_at,name,source_type,source_name,season,competition,date_from,date_to,valid_matches,discarded_matches,status,quality_summary,warnings")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("team_aliases")
          .select("id,created_at,updated_at,canonical_name,canonical_key,alias,alias_key,tournament,country,active,status,source,confidence,notes")
          .order("updated_at", { ascending: false })
          .limit(80),
        supabase.rpc("obtener_api_football_monitor"),
      ]);

      const error = summaryResp.error || runsResp.error || datasetsResp.error || aliasesResp.error;
      if (error) {
        setMensaje(error.message || "No fue posible cargar datos administrativos. Verifica permisos y migraciones.");
      }
      setSummary(summaryResp.data || null);
      setRuns(runsResp.error ? [] : runsResp.data || []);
      setDatasets(datasetsResp.error ? [] : datasetsResp.data || []);
      setAliases(aliasesResp.error ? [] : aliasesResp.data || []);
      setApiMonitor(apiMonitorResp.error ? null : apiMonitorResp.data || null);
    } catch (error) {
      setMensaje(error?.message || "No fue posible conectar con Supabase. Verifica configuración y migraciones.");
      setSummary(null);
      setRuns([]);
      setDatasets([]);
      setAliases([]);
      setApiMonitor(null);
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

  const runsFiltrados = useMemo(() => {
    const busqueda = filtros.busqueda.toLowerCase().trim();
    return runs.filter((run) => {
      if (filtros.modelo && run.model_version !== filtros.modelo) return false;
      if (filtros.tipo && run.run_type !== filtros.tipo) return false;
      if (filtros.estado && run.status !== filtros.estado) return false;
      if (!busqueda) return true;
      return [run.model_version, run.run_type, run.status, run.error_detail].join(" ").toLowerCase().includes(busqueda);
    });
  }, [filtros, runs]);

  const aliasesPendientes = aliases.filter((alias) => alias.status === "pending_review" && alias.active);
  const ultimoDatasetApi = datasets.find((dataset) => dataset.source_type === "api");
  const runsApi = runs.filter((run) => run.run_type === "api_import" || run.model_config?.provider === "api-football").slice(0, 5);
  const comandoApiBase = `python scripts/importar_desde_api.py --liga "${apiForm.liga || "ID_LIGA"}" --temporada "${apiForm.temporada || "TEMPORADA"}"`;

  const cambiarModeloActivo = async (modelo) => {
    if (!window.confirm(`¿Confirmas seleccionar ${modelo} como modelo activo administrativo?`)) return;
    setGuardando(true);
    const { data, error } = await supabase.rpc("guardar_model_prediction_settings", { p_active_model: modelo });
    if (error) setMensaje(error.message || "No fue posible cambiar el modelo activo.");
    else {
      setSummary((actual) => ({ ...(actual || {}), settings: data }));
      setMensaje(`Modelo activo actualizado a ${modelo}.`);
    }
    setGuardando(false);
  };

  const guardarAlias = async (event) => {
    event.preventDefault();
    if (!aliasForm.canonical || !aliasForm.alias) {
      setMensaje("Nombre canónico y alias son obligatorios.");
      return;
    }
    if (!window.confirm("¿Confirmas guardar este alias de equipo?")) return;
    setGuardando(true);
    const { error } = await supabase.rpc("guardar_team_alias", {
      p_canonical_name: aliasForm.canonical,
      p_canonical_key: normalizarClave(aliasForm.canonical),
      p_alias: aliasForm.alias,
      p_alias_key: normalizarClave(aliasForm.alias),
      p_tournament: aliasForm.tournament || null,
      p_country: aliasForm.country || null,
      p_status: "approved",
      p_source: "admin",
      p_confidence: 1,
      p_notes: aliasForm.notes || null,
    });
    if (error) setMensaje(error.message || "No fue posible guardar el alias.");
    else {
      setAliasForm({ canonical: "", alias: "", tournament: "", country: "", notes: "" });
      setMensaje("Alias guardado correctamente.");
      await cargarDatos();
    }
    setGuardando(false);
  };

  const actualizarAlias = async (alias, status, active = true) => {
    if (!window.confirm(`¿Confirmas cambiar el alias a ${status}?`)) return;
    const { error } = await supabase.rpc("actualizar_estado_team_alias", {
      p_alias_id: alias.id,
      p_status: status,
      p_active: active,
      p_canonical_name: alias.canonical_name,
      p_canonical_key: alias.canonical_key,
      p_notes: alias.notes,
    });
    if (error) setMensaje(error.message || "No fue posible actualizar el alias.");
    else {
      setMensaje("Alias actualizado.");
      await cargarDatos();
    }
  };

  const mostrarComando = (comando) => {
    setMensaje(`Ejecuta en la raíz del proyecto: ${comando}`);
  };

  if (!session?.user) {
    return <main className="admin-page"><section className="empty-league-card"><p>Debes iniciar sesión como administrador para ver este panel.</p></section></main>;
  }

  if (loadingProfile) {
    return <main className="admin-page"><section className="empty-league-card"><p>Cargando administración del modelo...</p></section></main>;
  }

  if (!esAdmin) {
    return <main className="admin-page"><section className="empty-league-card"><p>Acceso restringido. Tu usuario no tiene rol de administrador.</p></section></main>;
  }

  if (cargando) {
    return <main className="admin-page"><section className="empty-league-card"><p>Cargando administración del modelo...</p></section></main>;
  }

  return (
    <main className="admin-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/perfil")}>
        <ArrowLeft size={19} /> Volver
      </button>
      <header className="admin-header">
        <p className="brand">PREDIGOL ADMIN</p>
        <h1>Modelo de predicción</h1>
        <p>Administra trazabilidad, datasets, alias y comparaciones sin cambiar V1 por defecto.</p>
      </header>
      {mensaje && <p className="prediction-message">{mensaje}</p>}

      <section className="admin-data-health-card">
        <div className="admin-data-health-header">
          <div><p className="section-label">RESUMEN</p><h2>Estado general</h2></div>
          <button type="button" onClick={cargarDatos}><RefreshCw size={17} />Actualizar</button>
        </div>
        <div className="admin-data-health-grid">
          <span>Modelo activo: {summary?.settings?.active_model || "V1"}</span>
          <span>Última ejecución: {formatearFecha(summary?.last_successful_run?.finished_at || summary?.last_successful_run?.created_at)}</span>
          <span>Último backtest: {formatearFecha(summary?.last_backtest?.finished_at || summary?.last_backtest?.created_at)}</span>
          <span>Última importación: {summary?.last_import?.name || "Sin registro"}</span>
          <span>Históricos válidos: {summary?.history?.valid_matches ?? 0}</span>
          <span>Rango: {formatearFecha(summary?.history?.date_from)} - {formatearFecha(summary?.history?.date_to)}</span>
          <span>Torneos: {summary?.history?.tournaments?.length ?? 0}</span>
          <span>Equipos normalizados: {summary?.aliases?.normalized_teams ?? 0}</span>
          <span>Alias pendientes: {summary?.aliases?.pending_aliases ?? 0}</span>
          <span>Supabase: {summary?.supabase?.configured ? "OK" : "Sin configurar"}</span>
          <span>Python: externo via scripts</span>
        </div>
        <div className="admin-import-actions">
          <button type="button" disabled={guardando} onClick={() => cambiarModeloActivo("V1")}>Usar V1</button>
          <button type="button" disabled={guardando} onClick={() => cambiarModeloActivo("V2")}>Usar V2</button>
        </div>
      </section>

      <section className="admin-import-panel">
        <div><p className="section-label">ACCIONES</p><h2>Comandos del modelo</h2><span>El navegador no ejecuta Python directamente; usa estos comandos o conecta un worker/backend.</span></div>
        <div className="admin-import-actions">
          <button type="button" onClick={() => mostrarComando("python scripts/diagnostico_modelo_v1.py")}>Diagnóstico V1</button>
          <button type="button" onClick={() => mostrarComando("python scripts/diagnostico_modelo_v2.py")}>Diagnóstico V2</button>
          <button type="button" onClick={() => mostrarComando("python scripts/backtest_modelo_v1.py --model V1")}>Backtest V1</button>
          <button type="button" onClick={() => mostrarComando("python scripts/backtest_modelo_v1.py --model V2")}>Backtest V2</button>
          <button type="button" onClick={() => mostrarComando("python scripts/backtest_v1_v2.py --register")}>Comparativo V1/V2</button>
          <button type="button" onClick={() => mostrarComando("python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv")}>Validar dataset</button>
        </div>
      </section>

      <section className="admin-import-panel">
        <div>
          <p className="section-label">IMPORTACIÓN DESDE API</p>
          <h2>API-Football históricos</h2>
          <span>La clave privada vive en prediction-service/.env. El frontend no llama API-Football directamente.</span>
        </div>
        <div className="admin-data-health-grid">
          <span>API configurada: {apiMonitor ? "Backend/RPC disponible" : "No verificable desde frontend"}</span>
          <span>Última sincronización: {formatearFecha(apiMonitor?.summary?.last_success_at)}</span>
          <span>Requests 24h: {apiMonitor?.summary?.requests_24h ?? "N/D"}</span>
          <span>Errores 24h: {apiMonitor?.summary?.errors_24h ?? "N/D"}</span>
          <span>Último dataset API: {ultimoDatasetApi?.name || "Sin registro"}</span>
          <span>Partidos válidos último API: {ultimoDatasetApi?.valid_matches ?? 0}</span>
        </div>
        <div className="admin-filter-panel">
          <label>Liga API-Football<input value={apiForm.liga} onChange={(event) => setApiForm((actual) => ({ ...actual, liga: event.target.value }))} /></label>
          <label>Temporada<input value={apiForm.temporada} onChange={(event) => setApiForm((actual) => ({ ...actual, temporada: event.target.value }))} /></label>
        </div>
        <div className="admin-import-actions">
          <button type="button" onClick={() => mostrarComando("python scripts/importar_desde_api.py --listar-ligas")}>Listar ligas</button>
          <button type="button" onClick={() => mostrarComando(`python scripts/importar_desde_api.py --liga "${apiForm.liga || "ID_LIGA"}" --listar-temporadas`)}>Listar temporadas</button>
          <button type="button" onClick={() => mostrarComando(`${comandoApiBase} --dry-run`)}>Dry-run temporada</button>
          <button type="button" onClick={() => mostrarComando(`${comandoApiBase} --confirm`)}>Importar temporada</button>
          <button type="button" onClick={() => mostrarComando(`python scripts/sincronizar_partidos_api.py --liga "${apiForm.liga || "ID_LIGA"}"`)}>Sincronizar próximos</button>
        </div>
        <div className="admin-api-runs">
          {runsApi.length === 0 ? <p className="admin-data-health-note">No hay ejecuciones API registradas en model_runs.</p> : runsApi.map((run) => <article className="admin-api-run" key={run.id}><div><strong>{run.status}</strong><span>{formatearFecha(run.created_at)}</span></div><span>{run.used_matches} importados</span><span>{run.discarded_matches} descartados</span><span>{run.metrics?.provider || run.model_config?.provider || "api-football"}</span>{run.error_detail && <small>{run.error_detail}</small>}</article>)}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">EJECUCIONES</p><h2>model_runs</h2></div></div>
        <div className="admin-filter-panel">
          <label><Search size={16} /><input placeholder="Buscar" value={filtros.busqueda} onChange={(event) => setFiltros((actual) => ({ ...actual, busqueda: event.target.value }))} /></label>
          <select value={filtros.modelo} onChange={(event) => setFiltros((actual) => ({ ...actual, modelo: event.target.value }))}><option value="">Modelo</option>{[...new Set(runs.map((run) => run.model_version))].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={filtros.tipo} onChange={(event) => setFiltros((actual) => ({ ...actual, tipo: event.target.value }))}><option value="">Tipo</option>{[...new Set(runs.map((run) => run.run_type))].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={filtros.estado} onChange={(event) => setFiltros((actual) => ({ ...actual, estado: event.target.value }))}><option value="">Estado</option>{[...new Set(runs.map((run) => run.status))].map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="admin-api-runs">
          {runsFiltrados.length === 0 ? <p className="admin-data-health-note">No hay model_runs registrados.</p> : runsFiltrados.map((run) => <article className="admin-api-run" key={run.id}><div><strong>{run.model_version}</strong><span>{formatearFecha(run.created_at)}</span></div><span>{run.run_type}</span><span>{run.status}</span><span>{run.used_matches} usados</span><span>Brier {run.metrics?.brier_score ?? run.metrics?.["poisson-elo-v1"]?.brier_score ?? "-"}</span>{run.warnings?.length > 0 && <small>{run.warnings[0]}</small>}</article>)}
        </div>
      </section>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">DATASETS</p><h2>model_datasets</h2></div></div>
        <div className="admin-api-runs">
          {datasets.length === 0 ? <p className="admin-data-health-note">No hay datasets registrados.</p> : datasets.map((dataset) => <article className="admin-api-run" key={dataset.id}><div><strong>{dataset.name}</strong><span>{dataset.source_type} - {dataset.source_name}</span></div><span>{dataset.competition || "Varios"}</span><span>{dataset.season || "N/D"}</span><span>{dataset.valid_matches} válidos</span><span>{dataset.status}</span>{dataset.warnings?.length > 0 && <small>{dataset.warnings[0]}</small>}</article>)}
        </div>
      </section>

      <form className="admin-form" onSubmit={guardarAlias}>
        <label>Canónico<input value={aliasForm.canonical} onChange={(event) => setAliasForm((actual) => ({ ...actual, canonical: event.target.value }))} /></label>
        <label>Alias<input value={aliasForm.alias} onChange={(event) => setAliasForm((actual) => ({ ...actual, alias: event.target.value }))} /></label>
        <label>Torneo<input value={aliasForm.tournament} onChange={(event) => setAliasForm((actual) => ({ ...actual, tournament: event.target.value }))} /></label>
        <label>País<input value={aliasForm.country} onChange={(event) => setAliasForm((actual) => ({ ...actual, country: event.target.value }))} /></label>
        <label>Notas<input value={aliasForm.notes} onChange={(event) => setAliasForm((actual) => ({ ...actual, notes: event.target.value }))} /></label>
        <button type="submit" disabled={guardando}><Save size={17} />Guardar alias</button>
      </form>

      <section className="admin-data-health-card">
        <div className="admin-data-health-header"><div><p className="section-label">NORMALIZACIÓN</p><h2>Alias pendientes</h2></div></div>
        <div className="admin-api-runs">
          {aliasesPendientes.length === 0 ? <p className="admin-data-health-note">No hay alias pendientes.</p> : aliasesPendientes.map((alias) => <article className="admin-api-run" key={alias.id}><div><strong>{alias.alias}</strong><span>Canónico sugerido: {alias.canonical_name}</span></div><span>{alias.tournament || "sin torneo"}</span><span>{Math.round(Number(alias.confidence || 0) * 100)}%</span><button type="button" onClick={() => actualizarAlias(alias, "approved", true)}>Aprobar</button><button type="button" onClick={() => actualizarAlias(alias, "rejected", false)}>Rechazar</button></article>)}
        </div>
      </section>
    </main>
  );
}

export default ModelAdminPage;

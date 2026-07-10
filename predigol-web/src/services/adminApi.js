import { supabase } from "../lib/supabase.js";

const DATASET_SELECT = "id,created_at,updated_at,name,source_type,source_name,season,competition,total_matches,finished_matches,valid_matches,discarded_matches,status,quality_summary,warnings";
const MODEL_RUN_SELECT = "id,created_at,model_version,run_type,status,started_at,finished_at,dataset_id,available_matches,used_matches,discarded_matches,metrics,warnings,error_detail,model_config";
const PREDICTION_SELECT = "api_football_fixture_id,partido_id,home_win_probability,draw_probability,away_win_probability,expected_home_goals,expected_away_goals,predicted_home_goals,predicted_away_goals,confidence,model_version,metadata,generated_at,access_tier,premium_reason";
const PARTIDO_SELECT = "id,torneo,fecha_orden,local_nombre,visitante_nombre,estado,api_football_fixture_id";

async function safeQuery(promise, fallback = []) {
  try {
    const { data, error } = await promise;
    return { data: error ? fallback : data ?? fallback, error };
  } catch (error) {
    return { data: fallback, error };
  }
}

function indexBy(items, key) {
  return new Map((items || []).filter((item) => item?.[key] !== null && item?.[key] !== undefined).map((item) => [item[key], item]));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizarDatasetAdmin(dataset = {}) {
  return {
    id: dataset.id,
    name: dataset.name || "Dataset sin nombre",
    league: dataset.competition || "Varios",
    season: dataset.season || "N/D",
    source: [dataset.source_type, dataset.source_name].filter(Boolean).join(" - ") || "Sin fuente",
    totalMatches: toNumber(dataset.total_matches),
    finishedMatches: toNumber(dataset.finished_matches),
    validMatches: toNumber(dataset.valid_matches),
    discardedMatches: toNumber(dataset.discarded_matches),
    status: dataset.status || "unknown",
    createdAt: dataset.created_at || null,
    updatedAt: dataset.updated_at || null,
    warnings: Array.isArray(dataset.warnings) ? dataset.warnings : [],
  };
}

export function normalizarModelRunAdmin(run = {}) {
  return {
    id: run.id,
    createdAt: run.created_at || null,
    modelVersion: run.model_version || "sin-version",
    runType: run.run_type || "unknown",
    status: run.status || "unknown",
    startedAt: run.started_at || null,
    finishedAt: run.finished_at || null,
    datasetId: run.dataset_id || null,
    availableMatches: toNumber(run.available_matches),
    usedMatches: toNumber(run.used_matches),
    discardedMatches: toNumber(run.discarded_matches),
    brierScore: run.metrics?.brier_score ?? run.metrics?.[run.model_version]?.brier_score ?? null,
    metrics: run.metrics || {},
    warnings: Array.isArray(run.warnings) ? run.warnings : [],
    errorDetail: run.error_detail || null,
    provider: run.model_config?.provider || null,
  };
}

export function normalizarPrediccionAdmin(prediccion = {}, partido = {}) {
  const probabilities = {
    home: toNumber(prediccion.home_win_probability, null),
    draw: toNumber(prediccion.draw_probability, null),
    away: toNumber(prediccion.away_win_probability, null),
  };
  const predictedOutcome = Object.entries(probabilities)
    .filter(([, value]) => value !== null)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    apiFootballFixtureId: prediccion.api_football_fixture_id,
    partidoId: partido.id || prediccion.partido_id || null,
    league: partido.torneo || "Liga por confirmar",
    date: partido.fecha_orden || null,
    home: partido.local_nombre || "Local por confirmar",
    away: partido.visitante_nombre || "Visitante por confirmar",
    status: partido.estado || "sin-partido",
    homeProbability: probabilities.home,
    drawProbability: probabilities.draw,
    awayProbability: probabilities.away,
    predictedOutcome,
    predictedOutcomeLabel: predictedOutcome === "home" ? "Local" : predictedOutcome === "away" ? "Visitante" : predictedOutcome === "draw" ? "Empate" : "N/D",
    probableScore: `${prediccion.predicted_home_goals ?? "?"}-${prediccion.predicted_away_goals ?? "?"}`,
    confidence: toNumber(prediccion.confidence, null),
    modelVersion: prediccion.model_version || "sin-version",
    generatedAt: prediccion.generated_at || null,
    accessTier: prediccion.access_tier === "premium" ? "premium" : "free",
    premiumReason: prediccion.premium_reason || null,
  };
}

export function normalizarUsuarioPremiumAdmin(profile = {}, subscription = null) {
  const activePremium = Boolean(subscription && ["premium_active", "trial"].includes(subscription.status));
  return {
    userId: profile.id,
    name: profile.nombre || profile.username || "Usuario sin nombre",
    username: profile.username || "",
    role: profile.rol || (profile.es_admin ? "admin" : "usuario"),
    isAdmin: Boolean(profile.es_admin) || profile.rol === "admin",
    planCode: subscription?.plan_code || "free",
    status: subscription?.status || "free",
    isPremium: activePremium,
    startedAt: subscription?.started_at || null,
    expiresAt: subscription?.expires_at || null,
    source: subscription?.metadata?.source || subscription?.metadata?.payment_provider || "default_free",
  };
}

export async function obtenerDatasetsAdmin({ limit = 60 } = {}, client = supabase) {
  const { data, error } = await client
    .from("model_datasets")
    .select(DATASET_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(normalizarDatasetAdmin);
}

export async function obtenerModelRunsAdmin({ limit = 80 } = {}, client = supabase) {
  const { data, error } = await client
    .from("model_runs")
    .select(MODEL_RUN_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(normalizarModelRunAdmin);
}

export async function obtenerPrediccionesAdmin({ limit = 120 } = {}, client = supabase) {
  const { data: predictions, error } = await client
    .from("model_predictions")
    .select(PREDICTION_SELECT)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const fixtureIds = [...new Set((predictions || []).map((prediction) => prediction.api_football_fixture_id).filter(Boolean))];
  const partidosResponse = fixtureIds.length > 0
    ? await safeQuery(client.from("partidos").select(PARTIDO_SELECT).in("api_football_fixture_id", fixtureIds))
    : { data: [], error: null };

  const partidosByFixture = indexBy(partidosResponse.data, "api_football_fixture_id");
  return (predictions || []).map((prediction) => normalizarPrediccionAdmin(prediction, partidosByFixture.get(prediction.api_football_fixture_id) || {}));
}

export async function obtenerUsuariosPremiumAdmin({ limit = 80 } = {}, client = supabase) {
  const [profilesResponse, subscriptionsResponse] = await Promise.all([
    safeQuery(client.from("profiles").select("id,nombre,username,es_admin,rol").limit(limit)),
    safeQuery(client.from("user_subscriptions").select("id,user_id,plan_code,status,started_at,expires_at,metadata,created_at").order("created_at", { ascending: false }).limit(limit * 2)),
  ]);

  if (profilesResponse.error && subscriptionsResponse.error) {
    throw profilesResponse.error;
  }

  const activeByUser = new Map();
  for (const subscription of subscriptionsResponse.data || []) {
    if (!activeByUser.has(subscription.user_id)) {
      activeByUser.set(subscription.user_id, subscription);
    }
  }

  return (profilesResponse.data || []).map((profile) => normalizarUsuarioPremiumAdmin(profile, activeByUser.get(profile.id) || null));
}

export async function activarPremiumManualAdmin({ userId, days = 30, note = "" } = {}, client = supabase) {
  if (!userId) throw new Error("Selecciona un usuario.");
  const expiresAt = new Date(Date.now() + Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("user_subscriptions")
    .insert({
      user_id: userId,
      plan_code: "premium",
      status: "premium_active",
      expires_at: expiresAt,
      metadata: { source: "manual_admin", note: note || null },
    })
    .select("id,user_id,plan_code,status,started_at,expires_at,metadata")
    .single();

  if (error) throw error;
  return data;
}

export async function obtenerResumenAdmin({ limit = 120 } = {}, client = supabase) {
  const [summaryResponse, datasetsResponse, runsResponse, predictionsResponse, usersResponse, partidosResponse] = await Promise.all([
    safeQuery(client.rpc("obtener_model_admin_summary"), {}),
    safeQuery(client.from("model_datasets").select(DATASET_SELECT).order("created_at", { ascending: false }).limit(40)),
    safeQuery(client.from("model_runs").select(MODEL_RUN_SELECT).order("created_at", { ascending: false }).limit(40)),
    safeQuery(client.from("model_predictions").select(PREDICTION_SELECT).order("generated_at", { ascending: false }).limit(limit)),
    obtenerUsuariosPremiumAdmin({ limit: 200 }, client).then((data) => ({ data, error: null })).catch((error) => ({ data: [], error })),
    safeQuery(client.from("partidos").select("id,estado,fecha_orden").limit(3000)),
  ]);

  const datasets = (datasetsResponse.data || []).map(normalizarDatasetAdmin);
  const runs = (runsResponse.data || []).map(normalizarModelRunAdmin);
  const predictions = predictionsResponse.data || [];
  const users = usersResponse.data || [];
  const partidos = partidosResponse.data || [];
  const upcomingMatches = partidos.filter((partido) => partido.estado === "proximo" || partido.estado === "en vivo").length;

  return {
    model: {
      production: "poisson-elo-v1",
      productionLabel: "V1",
      experimental: "poisson-elo-form-v2",
      experimentalLabel: "V2",
      activeSetting: summaryResponse.data?.settings?.active_model || "V1",
    },
    counts: {
      datasets: datasets.length,
      modelRuns: runs.length,
      predictions: predictions.length,
      upcomingMatches,
      premiumUsers: users.filter((user) => user.isPremium).length,
      freeUsers: users.filter((user) => !user.isPremium).length,
      premiumPredictions: predictions.filter((prediction) => prediction.access_tier === "premium").length,
      freePredictions: predictions.filter((prediction) => prediction.access_tier !== "premium").length,
    },
    warnings: [
      "V2 experimental, no usar como producción todavía.",
      "Pagos reales pendientes: premium se gestiona manualmente hasta integrar pasarela.",
      "Premium protegido desde backend/RLS/RPC; el frontend solo refleja permisos.",
    ],
    lastRuns: runs.slice(0, 5),
    lastDatasets: datasets.slice(0, 5),
    errors: [summaryResponse.error, datasetsResponse.error, runsResponse.error, predictionsResponse.error, usersResponse.error, partidosResponse.error]
      .filter(Boolean)
      .map((error) => error.message || "Error administrativo sin detalle."),
  };
}

import {
  construirCalidadDatosPartidos,
  construirListadoAdmin,
  construirResumenAdminPartidos,
  construirResumenMvp,
  normalizarEstadoSincronizacionFootball,
} from "./adminFootballMappers.js";

export const ADMIN_PARTIDOS_SELECT = `
  id,
  torneo,
  fecha_texto,
  fecha_orden,
  local_nombre,
  visitante_nombre,
  local_corto,
  visitante_corto,
  estado,
  goles_local_final,
  goles_visitante_final,
  api_football_fixture_id,
  api_football_league_id,
  temporada,
  ronda,
  minuto,
  origen_datos,
  fuente_detalle,
  es_relevante,
  prioridad_visual
`;

export const ADMIN_FOOTBALL_FIXTURES_SELECT = `
  api_football_fixture_id,
  competition_api_id,
  season_start_year,
  round,
  kickoff_at,
  status,
  status_short,
  elapsed,
  venue_name,
  venue_city,
  home_team_api_id,
  away_team_api_id,
  goals_home,
  goals_away,
  score_fulltime_home,
  score_fulltime_away
`;

const MODEL_EVALUATIONS_SELECT = "model_version,evaluated_at,split_date,training_matches,test_matches,outcome_accuracy,exact_score_accuracy,home_goals_mae,away_goals_mae,brier_score,log_loss,baseline_outcome_accuracy,baseline_brier_score,metadata";

async function resolverRespuesta(promise, fallback = []) {
  try {
    const { data, error } = await promise;
    if (error) return { data: fallback, error };
    return { data: data ?? fallback, error: null };
  } catch (error) {
    return { data: fallback, error };
  }
}

function uniqueValues(items) {
  return [...new Set((items || []).filter((item) => item !== null && item !== undefined))];
}

export async function obtenerPartidosAdminConFiltros({ limit = 120 } = {}, client) {
  const [partidosResponse, fixturesResponse] = await Promise.all([
    resolverRespuesta(
      client.from("partidos").select(ADMIN_PARTIDOS_SELECT).order("fecha_orden", { ascending: false }).limit(limit)
    ),
    resolverRespuesta(
      client.from("football_fixtures").select(ADMIN_FOOTBALL_FIXTURES_SELECT).order("kickoff_at", { ascending: false }).limit(limit)
    ),
  ]);

  if (partidosResponse.error && fixturesResponse.error) {
    throw new Error("No se pudo cargar el resumen admin.");
  }

  const fixtures = fixturesResponse.data || [];
  const teamIds = uniqueValues(fixtures.flatMap((fixture) => [fixture.home_team_api_id, fixture.away_team_api_id]));
  const competitionIds = uniqueValues(fixtures.map((fixture) => fixture.competition_api_id));

  const [teamsResponse, competitionsResponse] = await Promise.all([
    teamIds.length > 0
      ? resolverRespuesta(client.from("football_teams").select("api_football_team_id,name,code,logo_url").in("api_football_team_id", teamIds))
      : Promise.resolve({ data: [], error: null }),
    competitionIds.length > 0
      ? resolverRespuesta(client.from("football_competitions").select("api_football_league_id,name,country,season_start_year").in("api_football_league_id", competitionIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  return construirListadoAdmin({
    partidos: partidosResponse.data || [],
    fixtures,
    teams: teamsResponse.data || [],
    competitions: competitionsResponse.data || [],
  });
}

export async function obtenerResumenAdminPartidos(client) {
  const [partidosResponse, fixturesResponse, teamsResponse, predictionsResponse, monitorResponse] = await Promise.all([
    resolverRespuesta(client.from("partidos").select(ADMIN_PARTIDOS_SELECT).limit(3000)),
    resolverRespuesta(client.from("football_fixtures").select(ADMIN_FOOTBALL_FIXTURES_SELECT).limit(3000)),
    resolverRespuesta(client.from("football_teams").select("api_football_team_id,name,code,logo_url").limit(3000)),
    resolverRespuesta(client.from("model_predictions").select("api_football_fixture_id,confidence,generated_at,model_version").order("generated_at", { ascending: false }).limit(3000)),
    resolverRespuesta(client.rpc("obtener_api_football_monitor"), { runs: [], summary: {}, config: {} }),
  ]);

  return construirResumenAdminPartidos({
    partidos: partidosResponse.data || [],
    fixtures: fixturesResponse.data || [],
    teams: teamsResponse.data || [],
    predictions: predictionsResponse.data || [],
    syncRuns: monitorResponse.data?.runs || [],
    errores: {
      partidos: partidosResponse.error?.message ?? null,
      fixtures: fixturesResponse.error?.message ?? null,
      teams: teamsResponse.error?.message ?? null,
      predictions: predictionsResponse.error?.message ?? null,
      monitor: monitorResponse.error?.message ?? null,
    },
  });
}

export async function obtenerCalidadDatosPartidos(client) {
  const resumen = await obtenerResumenAdminPartidos(client);
  return construirCalidadDatosPartidos(resumen);
}

export async function obtenerResumenYCalidadAdminPartidos(client) {
  const resumen = await obtenerResumenAdminPartidos(client);
  return {
    resumen,
    calidad: construirCalidadDatosPartidos(resumen),
  };
}

export async function obtenerResumenDatosMvp(client, minimoHistoricosModelo = 30) {
  const [partidosResponse, predictionsResponse, evaluationsResponse, clientErrorsResponse] = await Promise.all([
    resolverRespuesta(client.from("partidos").select("id,estado,origen_datos,es_relevante,goles_local_final,goles_visitante_final,api_football_fixture_id").limit(3000)),
    resolverRespuesta(client.from("model_predictions").select("api_football_fixture_id,confidence,generated_at,model_version").order("generated_at", { ascending: false }).limit(3000)),
    resolverRespuesta(client.from("model_evaluations").select(MODEL_EVALUATIONS_SELECT).order("evaluated_at", { ascending: false }).limit(8)),
    resolverRespuesta(client.from("app_error_logs").select("source,message,route,created_at").order("created_at", { ascending: false }).limit(20)),
  ]);

  if (partidosResponse.error) {
    return { error: "No fue posible cargar el resumen admin." };
  }

  const resumen = construirResumenMvp({
    partidos: partidosResponse.data || [],
    predictions: predictionsResponse.data || [],
    evaluations: evaluationsResponse.data || [],
    clientErrors: clientErrorsResponse.data || [],
    errores: {
      predictions: predictionsResponse.error ? "No fue posible leer predicciones." : null,
      evaluations: evaluationsResponse.error ? "No fue posible leer evaluaciones." : null,
      clientErrors: clientErrorsResponse.error ? "No fue posible leer errores web." : null,
    },
  });

  const faltanHistoricos = Math.max(minimoHistoricosModelo - resumen.historicosEntrenables, 0);
  return {
    ...resumen,
    faltanHistoricos,
    listoModelo: faltanHistoricos === 0 && resumen.proximosRelevantes > 0,
  };
}

export async function obtenerEstadoSincronizacionFootball(client) {
  const { data, error } = await resolverRespuesta(client.rpc("obtener_api_football_monitor"), {
    runs: [],
    summary: {},
    config: {},
  });

  return normalizarEstadoSincronizacionFootball(
    error ? { error: "No fue posible cargar el monitor de API-Football.", runs: [], summary: {}, config: {} } : data
  );
}

export async function obtenerUltimasSincronizacionesFootball(client) {
  const estado = await obtenerEstadoSincronizacionFootball(client);
  return estado.runs;
}

export async function obtenerConfiguracionSyncFootball(client) {
  const estado = await obtenerEstadoSincronizacionFootball(client);
  return estado.config;
}

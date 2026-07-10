import { supabase } from "../lib/supabase.js";
import {
  adaptPartidoRow,
  getCanonicalTeamKey,
  normalizeTeamName,
  resolveTeamLogo,
} from "./footballNormalizers.js";
import {
  adaptInternalMatchToDetailPartido,
  adaptInternalMatchToPartidoRow,
  mapFootballFixtureToInternalMatch,
  mapPartidoToInternalMatch,
  selectFootballSourceRows,
} from "./footballMappers.js";

export {
  adaptInternalMatchToPartidoRow,
  adaptInternalMatchToDetailPartido,
  mapFootballFixtureToInternalMatch,
  mapPartidoToInternalMatch,
  selectFootballSourceRows,
} from "./footballMappers.js";

export const PARTIDOS_SELECT = `
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

export const FOOTBALL_FIXTURES_SELECT = `
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

function uniqueTeamNames(partidos) {
  return [
    ...new Set(
      (partidos || [])
        .flatMap((partido) => [partido.local_nombre, partido.visitante_nombre])
        .filter(Boolean)
    ),
  ];
}

function uniqueValues(items) {
  return [...new Set((items || []).filter((item) => item !== null && item !== undefined))];
}

function indexBy(items, key) {
  return new Map((items || []).map((item) => [item[key], item]));
}

export async function obtenerMapaLogosEquipos(teamNames, client = supabase) {
  const names = [...new Set((teamNames || []).filter(Boolean))];

  if (names.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("football_teams")
    .select("name, code, logo_url")
    .in("name", names);

  if (error) {
    console.warn("No fue posible cargar escudos reales:", error.message || error);
    return new Map();
  }

  return new Map(
    (data || [])
      .filter((team) => team.logo_url)
      .flatMap((team) => {
        const keys = [normalizeTeamName(team.name), getCanonicalTeamKey(team.name)];
        return [...new Set(keys.filter(Boolean))].map((key) => [key, team.logo_url]);
      })
  );
}

export function enriquecerPartidosConLogos(partidos, logoMap) {
  return (partidos || []).map((partido) => ({
    ...partido,
    local_logo_url: resolveTeamLogo(partido.local_nombre, logoMap, undefined, partido.local_logo_url),
    visitante_logo_url: resolveTeamLogo(partido.visitante_nombre, logoMap, undefined, partido.visitante_logo_url),
  }));
}

async function obtenerPartidosFallback(query, client = supabase) {
  return obtenerPartidos(query, client);
}

async function obtenerFootballFixtures(query, client = supabase) {
  const { data, error } = await query;

  if (error || !data?.length) {
    return [];
  }

  const teamIds = uniqueValues(
    data.flatMap((fixture) => [fixture.home_team_api_id, fixture.away_team_api_id])
  );
  const competitionIds = uniqueValues(data.map((fixture) => fixture.competition_api_id));
  const fixtureIds = uniqueValues(data.map((fixture) => fixture.api_football_fixture_id));

  const [teamsResponse, competitionsResponse, partidosResponse] = await Promise.all([
    teamIds.length > 0
      ? client.from("football_teams").select("api_football_team_id,name,code,logo_url").in("api_football_team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    competitionIds.length > 0
      ? client.from("football_competitions").select("api_football_league_id,name,country,season_start_year").in("api_football_league_id", competitionIds)
      : Promise.resolve({ data: [], error: null }),
    fixtureIds.length > 0
      ? client.from("partidos").select(PARTIDOS_SELECT).in("api_football_fixture_id", fixtureIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (teamsResponse.error || competitionsResponse.error || partidosResponse.error) {
    return [];
  }

  const partidosByFixtureId = indexBy(partidosResponse.data, "api_football_fixture_id");
  const matches = data
    .map((fixture) => mapFootballFixtureToInternalMatch(fixture, {
      teamsById: indexBy(teamsResponse.data, "api_football_team_id"),
      competitionsById: indexBy(competitionsResponse.data, "api_football_league_id"),
      partidosByFixtureId,
    }))
    .filter((match) => match.id);

  if (matches.length === 0) {
    return [];
  }

  const rows = matches.map(adaptInternalMatchToPartidoRow);
  const logoMap = await obtenerMapaLogosEquipos(uniqueTeamNames(rows), client);
  return enriquecerPartidosConLogos(rows, logoMap).map(adaptPartidoRow);
}

async function obtenerPartidosCompatibles({ fixtureQuery, fallbackQuery }, client = supabase) {
  try {
    const fixtures = await obtenerFootballFixtures(fixtureQuery, client);
    const selected = selectFootballSourceRows(fixtures, []);
    if (selected.source === "football_fixtures") return selected.rows;
  } catch (error) {
    console.warn("No fue posible leer football_fixtures, usando fallback partidos:", error.message || error);
  }

  return obtenerPartidosFallback(fallbackQuery, client);
}

export async function obtenerPartidos(query, client = supabase) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const partidos = data || [];
  const logoMap = await obtenerMapaLogosEquipos(uniqueTeamNames(partidos), client);
  return enriquecerPartidosConLogos(partidos, logoMap).map(adaptPartidoRow);
}

async function obtenerFixtureEnriquecidoParaPartido(partido, client = supabase) {
  if (!partido?.api_football_fixture_id) {
    return null;
  }

  const { data: fixture, error } = await client
    .from("football_fixtures")
    .select(FOOTBALL_FIXTURES_SELECT)
    .eq("api_football_fixture_id", partido.api_football_fixture_id)
    .maybeSingle();

  if (error || !fixture) {
    return null;
  }

  const teamIds = uniqueValues([fixture.home_team_api_id, fixture.away_team_api_id]);
  const competitionIds = uniqueValues([fixture.competition_api_id]);

  const [teamsResponse, competitionsResponse] = await Promise.all([
    teamIds.length > 0
      ? client.from("football_teams").select("api_football_team_id,name,code,logo_url").in("api_football_team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    competitionIds.length > 0
      ? client.from("football_competitions").select("api_football_league_id,name,country,season_start_year").in("api_football_league_id", competitionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (teamsResponse.error || competitionsResponse.error) {
    return null;
  }

  return mapFootballFixtureToInternalMatch(fixture, {
    teamsById: indexBy(teamsResponse.data, "api_football_team_id"),
    competitionsById: indexBy(competitionsResponse.data, "api_football_league_id"),
    partidosByFixtureId: new Map([[partido.api_football_fixture_id, partido]]),
  });
}

export async function obtenerDetallePartido(partidoId, usuarioId, client = supabase) {
  const { data: partidoData, error: partidoError } = await client
    .from("partidos")
    .select(PARTIDOS_SELECT)
    .eq("id", partidoId)
    .maybeSingle();

  if (partidoError) throw partidoError;
  if (!partidoData) throw new Error("No encontramos este partido.");

  const [partidoBase] = await obtenerPartidos(Promise.resolve({ data: [partidoData], error: null }), client);
  const fixtureMatch = await obtenerFixtureEnriquecidoParaPartido(partidoBase, client);
  const internalMatch = fixtureMatch || mapPartidoToInternalMatch(partidoBase);
  const rowWithLogos = enriquecerPartidosConLogos([adaptInternalMatchToPartidoRow(internalMatch)], await obtenerMapaLogosEquipos([
    internalMatch.homeTeamName,
    internalMatch.awayTeamName,
  ], client))[0];
  const partido = adaptInternalMatchToDetailPartido(mapPartidoToInternalMatch(rowWithLogos));
  partido.source = internalMatch.source;
  partido.venue = internalMatch.venue;
  partido.fuenteDetalle = internalMatch.legacy?.fuente_detalle || internalMatch.source;

  const historialSelect = `
    id, torneo, fecha_orden, local_nombre, visitante_nombre, estado,
    goles_local_final, goles_visitante_final
  `;
  const consultas = [
    client
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante, actualizado_en")
      .eq("usuario_id", usuarioId)
      .eq("partido_id", partido.id)
      .maybeSingle(),
    client
      .from("partidos")
      .select(historialSelect)
      .eq("estado", "finalizado")
      .not("goles_local_final", "is", null)
      .not("goles_visitante_final", "is", null)
      .in("local_nombre", [partido.local, partido.visitante])
      .order("fecha_orden", { ascending: false })
      .limit(12),
    client
      .from("partidos")
      .select(historialSelect)
      .eq("estado", "finalizado")
      .not("goles_local_final", "is", null)
      .not("goles_visitante_final", "is", null)
      .in("visitante_nombre", [partido.local, partido.visitante])
      .order("fecha_orden", { ascending: false })
      .limit(12),
  ];

  if (partido.apiFootballFixtureId) {
    consultas.push(
      client
        .from("model_predictions")
        .select(
          `
            api_football_fixture_id, home_win_probability, draw_probability,
            away_win_probability, expected_home_goals, expected_away_goals,
            predicted_home_goals, predicted_away_goals, confidence,
            model_version, generated_at, metadata
          `
        )
        .eq("api_football_fixture_id", partido.apiFootballFixtureId)
        .maybeSingle(),
      client
        .from("football_live_snapshots")
        .select("id, captured_at, status, status_short, elapsed, goals_home, goals_away")
        .eq("api_football_fixture_id", partido.apiFootballFixtureId)
        .order("captured_at", { ascending: false })
        .limit(12)
    );
  }

  const [respuestaPronostico, respuestaHistorialLocal, respuestaHistorialVisitante, respuestaModelo, respuestaSnapshots] = await Promise.all(consultas);

  for (const respuesta of [respuestaPronostico, respuestaHistorialLocal, respuestaHistorialVisitante, respuestaModelo, respuestaSnapshots]) {
    if (respuesta?.error) throw respuesta.error;
  }

  const historialMap = new Map();
  [...(respuestaHistorialLocal.data || []), ...(respuestaHistorialVisitante.data || [])]
    .filter((item) => item.id !== partido.id)
    .forEach((item) => historialMap.set(item.id, item));

  const historial = [...historialMap.values()]
    .sort((a, b) => new Date(b.fecha_orden).getTime() - new Date(a.fecha_orden).getTime())
    .slice(0, 12);

  return {
    partido,
    pronostico: respuestaPronostico.data,
    prediccionModelo: respuestaModelo?.data || null,
    modelPrediction: respuestaModelo?.data || null,
    snapshots: respuestaSnapshots?.data || [],
    liveSnapshot: respuestaSnapshots?.data?.[0] || null,
    historial,
  };
}

export function adaptarPartidoParaApp(partido) {
  return {
    id: partido.id,
    apiFootballFixtureId: partido.api_football_fixture_id,
    torneo: partido.torneo,
    fecha: partido.fecha_texto,
    fechaOrden: partido.fecha_orden,
    local: partido.local_nombre,
    visitante: partido.visitante_nombre,
    localShort: partido.local_corto,
    visitanteShort: partido.visitante_corto,
    localLogoUrl: partido.localLogoUrl,
    visitanteLogoUrl: partido.visitanteLogoUrl,
    estado: partido.estado,
    esRelevante: partido.es_relevante,
    prioridadVisual: partido.prioridad_visual,
    resultadoFinal:
      partido.estado === "finalizado"
        ? {
            local: partido.goles_local_final,
            visitante: partido.goles_visitante_final,
          }
        : null,
    minuto: partido.minuto,
  };
}

export async function obtenerPartidosInicio(usuarioId, client = supabase) {
  const [partidos, respuestaPronosticos] = await Promise.all([
    obtenerPartidosCompatibles({
      fixtureQuery: client
        .from("football_fixtures")
        .select(FOOTBALL_FIXTURES_SELECT)
        .order("kickoff_at", { ascending: true })
        .limit(40),
      fallbackQuery: client
        .from("partidos")
        .select(PARTIDOS_SELECT)
        .eq("es_relevante", true)
        .order("prioridad_visual", { ascending: true })
        .order("fecha_orden", { ascending: true })
        .limit(40),
    }, client),
    client
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante")
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaPronosticos.error) {
    throw respuestaPronosticos.error;
  }

  const apiFootballFixtureIds = partidos
    .map((partido) => partido.api_football_fixture_id)
    .filter(Boolean);

  let prediccionesModelo = {};

  if (apiFootballFixtureIds.length > 0) {
    const respuestaPredicciones = await client
      .from("model_predictions")
      .select(
        `
          api_football_fixture_id,
          home_win_probability,
          draw_probability,
          away_win_probability,
          expected_home_goals,
          expected_away_goals,
          predicted_home_goals,
          predicted_away_goals,
          confidence,
          model_version,
          generated_at
        `
      )
      .in("api_football_fixture_id", apiFootballFixtureIds);

    if (respuestaPredicciones.error) {
      console.warn(
        "No fue posible cargar predicciones del modelo:",
        respuestaPredicciones.error
      );
    } else {
      prediccionesModelo = Object.fromEntries(
        (respuestaPredicciones.data || []).map((prediccion) => [
          prediccion.api_football_fixture_id,
          prediccion,
        ])
      );
    }
  }

  return {
    partidos: partidos.map(adaptarPartidoParaApp),
    pronosticos: Object.fromEntries(
      (respuestaPronosticos.data || []).map((pronostico) => [
        pronostico.partido_id,
        {
          local: pronostico.goles_local,
          visitante: pronostico.goles_visitante,
        },
      ])
    ),
    prediccionesModelo,
  };
}

export async function obtenerPronosticosModelo({ limit = 24, freeLimit = 8 } = {}, client = supabase) {
  const { data: predicciones, error } = await client
    .from("model_predictions")
    .select(
      `
        api_football_fixture_id,
        partido_id,
        home_win_probability,
        draw_probability,
        away_win_probability,
        expected_home_goals,
        expected_away_goals,
        predicted_home_goals,
        predicted_away_goals,
        confidence,
        model_version,
        generated_at
      `
    )
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const fixtureIds = uniqueValues((predicciones || []).map((item) => item.api_football_fixture_id));
  const partidosResponse = fixtureIds.length > 0
    ? await client.from("partidos").select(PARTIDOS_SELECT).in("api_football_fixture_id", fixtureIds)
    : { data: [], error: null };

  if (partidosResponse.error) throw partidosResponse.error;

  const partidosByFixtureId = indexBy(partidosResponse.data, "api_football_fixture_id");

  return (predicciones || []).map((prediccion, index) => {
    const partido = partidosByFixtureId.get(prediccion.api_football_fixture_id) || {};
    const probabilities = {
      home: Number(prediccion.home_win_probability || 0),
      draw: Number(prediccion.draw_probability || 0),
      away: Number(prediccion.away_win_probability || 0),
    };
    const predictedOutcome = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] || "home";
    return {
      apiFootballFixtureId: prediccion.api_football_fixture_id,
      partidoId: partido.id || prediccion.partido_id,
      liga: partido.torneo || "Liga por confirmar",
      fechaOrden: partido.fecha_orden || null,
      local: partido.local_nombre || "Local por confirmar",
      visitante: partido.visitante_nombre || "Visitante por confirmar",
      pHome: probabilities.home,
      pDraw: probabilities.draw,
      pAway: probabilities.away,
      predictedOutcome,
      predictedOutcomeLabel: predictedOutcome === "home" ? "Local" : predictedOutcome === "away" ? "Visitante" : "Empate",
      probableScore: `${prediccion.predicted_home_goals}-${prediccion.predicted_away_goals}`,
      expectedHomeGoals: prediccion.expected_home_goals,
      expectedAwayGoals: prediccion.expected_away_goals,
      confidence: Number(prediccion.confidence || 0),
      modelVersion: prediccion.model_version,
      generatedAt: prediccion.generated_at,
      accessTier: index < freeLimit ? "free" : "premium_candidate",
    };
  });
}

export async function obtenerPartidosExplorador({ limit = 200 } = {}, client = supabase) {
  return obtenerPartidosCompatibles({
    fixtureQuery: client
      .from("football_fixtures")
      .select(FOOTBALL_FIXTURES_SELECT)
      .order("kickoff_at", { ascending: false })
      .limit(limit),
    fallbackQuery: client
      .from("partidos")
      .select(PARTIDOS_SELECT)
      .order("fecha_orden", { ascending: false })
      .limit(limit),
  }, client);
}

export async function obtenerPartidosPorTorneo(nombre, client = supabase) {
  return obtenerPartidosFallback(
    client.from("partidos").select(PARTIDOS_SELECT).eq("torneo", nombre).order("fecha_orden", { ascending: false }).limit(100),
    client
  );
}

export async function obtenerPartidosPorEquipo(nombre, client = supabase) {
  const [localResponse, awayResponse] = await Promise.all([
    obtenerPartidos(
      client
        .from("partidos")
        .select(PARTIDOS_SELECT)
        .eq("local_nombre", nombre)
        .order("fecha_orden", { ascending: false })
        .limit(60),
      client
    ),
    obtenerPartidos(
      client
        .from("partidos")
        .select(PARTIDOS_SELECT)
        .eq("visitante_nombre", nombre)
        .order("fecha_orden", { ascending: false })
        .limit(60),
      client
    ),
  ]);

  const unique = new Map();
  [...localResponse, ...awayResponse].forEach((partido) => unique.set(partido.id, partido));
  return [...unique.values()].sort(
    (a, b) => new Date(b.fecha_orden).getTime() - new Date(a.fecha_orden).getTime()
  );
}

export async function obtenerPartidosAdmin({ limit = 120 } = {}, client = supabase) {
  return obtenerPartidosCompatibles({
    fixtureQuery: client
      .from("football_fixtures")
      .select(FOOTBALL_FIXTURES_SELECT)
      .order("kickoff_at", { ascending: false })
      .limit(limit),
    fallbackQuery: client
      .from("partidos")
      .select(PARTIDOS_SELECT)
      .order("fecha_orden", { ascending: false })
      .limit(limit),
  }, client);
}

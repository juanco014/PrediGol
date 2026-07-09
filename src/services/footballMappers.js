import { normalizeMatchStatus } from "./footballNormalizers.js";

export function mapPartidoToInternalMatch(partido) {
  return {
    id: partido.id,
    source: "partidos",
    externalId: partido.api_football_fixture_id ?? null,
    leagueId: partido.api_football_league_id ?? null,
    leagueName: partido.torneo ?? null,
    season: partido.temporada ?? null,
    homeTeamId: null,
    awayTeamId: null,
    homeTeamName: partido.local_nombre ?? null,
    awayTeamName: partido.visitante_nombre ?? null,
    homeLogoUrl: partido.local_logo_url ?? partido.localLogoUrl ?? null,
    awayLogoUrl: partido.visitante_logo_url ?? partido.visitanteLogoUrl ?? null,
    kickoffAt: partido.fecha_orden ?? null,
    displayDate: partido.fecha_texto ?? null,
    status: normalizeMatchStatus(partido.estado),
    statusShort: null,
    elapsed: partido.minuto ?? null,
    homeScore: partido.goles_local_final ?? null,
    awayScore: partido.goles_visitante_final ?? null,
    venue: null,
    round: partido.ronda ?? null,
    prediction: null,
    legacy: partido,
  };
}

export function mapFootballFixtureToInternalMatch(fixture, context = {}) {
  const homeTeam = context.teamsById?.get(fixture.home_team_api_id) || null;
  const awayTeam = context.teamsById?.get(fixture.away_team_api_id) || null;
  const competition = context.competitionsById?.get(fixture.competition_api_id) || null;
  const linkedPartido = context.partidosByFixtureId?.get(fixture.api_football_fixture_id) || null;
  const status = normalizeMatchStatus(fixture.status_short || fixture.status);
  const homeScore = fixture.score_fulltime_home ?? fixture.goals_home ?? null;
  const awayScore = fixture.score_fulltime_away ?? fixture.goals_away ?? null;

  return {
    id: linkedPartido?.id ?? null,
    source: "football_fixtures",
    externalId: fixture.api_football_fixture_id ?? null,
    leagueId: fixture.competition_api_id ?? null,
    leagueName: competition?.name ?? linkedPartido?.torneo ?? null,
    season: fixture.season_start_year ?? linkedPartido?.temporada ?? null,
    homeTeamId: fixture.home_team_api_id ?? null,
    awayTeamId: fixture.away_team_api_id ?? null,
    homeTeamName: homeTeam?.name ?? linkedPartido?.local_nombre ?? null,
    awayTeamName: awayTeam?.name ?? linkedPartido?.visitante_nombre ?? null,
    homeLogoUrl: homeTeam?.logo_url ?? linkedPartido?.local_logo_url ?? null,
    awayLogoUrl: awayTeam?.logo_url ?? linkedPartido?.visitante_logo_url ?? null,
    kickoffAt: fixture.kickoff_at ?? linkedPartido?.fecha_orden ?? null,
    displayDate: linkedPartido?.fecha_texto ?? fixture.kickoff_at ?? null,
    status,
    statusShort: fixture.status_short ?? null,
    elapsed: fixture.elapsed ?? linkedPartido?.minuto ?? null,
    homeScore,
    awayScore,
    venue: fixture.venue_name || fixture.venue_city
      ? [fixture.venue_name, fixture.venue_city].filter(Boolean).join(" · ")
      : null,
    round: fixture.round ?? linkedPartido?.ronda ?? null,
    prediction: null,
    legacy: linkedPartido,
  };
}

export function adaptInternalMatchToPartidoRow(match) {
  return {
    ...(match.legacy || {}),
    id: match.id,
    torneo: match.leagueName,
    fecha_texto: match.displayDate,
    fecha_orden: match.kickoffAt,
    local_nombre: match.homeTeamName,
    visitante_nombre: match.awayTeamName,
    local_corto: match.legacy?.local_corto || null,
    visitante_corto: match.legacy?.visitante_corto || null,
    estado: match.status,
    goles_local_final: match.status === "finalizado" ? match.homeScore : match.legacy?.goles_local_final ?? null,
    goles_visitante_final: match.status === "finalizado" ? match.awayScore : match.legacy?.goles_visitante_final ?? null,
    api_football_fixture_id: match.externalId,
    api_football_league_id: match.leagueId,
    temporada: match.season,
    ronda: match.round,
    minuto: match.elapsed,
    local_logo_url: match.homeLogoUrl,
    visitante_logo_url: match.awayLogoUrl,
    origen_datos: match.legacy?.origen_datos || match.source,
    fuente_detalle: match.legacy?.fuente_detalle || null,
    es_relevante: match.legacy?.es_relevante ?? true,
    prioridad_visual: match.legacy?.prioridad_visual ?? 100,
  };
}

export function adaptInternalMatchToDetailPartido(match) {
  return {
    id: match.id,
    source: match.source,
    externalId: match.externalId,
    apiFootballFixtureId: match.externalId,
    torneo: match.leagueName,
    leagueName: match.leagueName,
    leagueId: match.leagueId,
    fecha: match.displayDate,
    fechaOrden: match.kickoffAt,
    kickoffAt: match.kickoffAt,
    local: match.homeTeamName,
    visitante: match.awayTeamName,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    localShort: match.legacy?.local_corto || null,
    visitanteShort: match.legacy?.visitante_corto || null,
    localLogoUrl: match.homeLogoUrl,
    visitanteLogoUrl: match.awayLogoUrl,
    homeLogoUrl: match.homeLogoUrl,
    awayLogoUrl: match.awayLogoUrl,
    estado: match.status,
    status: match.status,
    ronda: match.round,
    round: match.round,
    temporada: match.season,
    season: match.season,
    venue: match.venue,
    origenDatos: match.legacy?.origen_datos || match.source,
    fuenteDetalle: match.legacy?.fuente_detalle || match.source,
    minuto: match.elapsed,
    resultadoFinal:
      match.status === "finalizado" && match.homeScore !== null && match.awayScore !== null
        ? { local: match.homeScore, visitante: match.awayScore }
        : null,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    legacyPartido: match.legacy || null,
  };
}

export function selectFootballSourceRows(fixtureRows, fallbackRows) {
  if ((fixtureRows || []).length > 0) {
    return { source: "football_fixtures", rows: fixtureRows };
  }

  return { source: "partidos", rows: fallbackRows || [] };
}

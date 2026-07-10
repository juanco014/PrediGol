import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptInternalMatchToPartidoRow,
  adaptInternalMatchToDetailPartido,
  obtenerPronosticosModelo,
  mapFootballFixtureToInternalMatch,
  mapPartidoToInternalMatch,
  selectFootballSourceRows,
} from "./footballApi.js";

test("mapFootballFixtureToInternalMatch normaliza football_fixtures con equipos y liga", () => {
  const fixture = {
    api_football_fixture_id: 101,
    competition_api_id: 239,
    season_start_year: 2026,
    round: "Fecha 1",
    kickoff_at: "2026-07-08T20:00:00Z",
    status: "Match Finished",
    status_short: "FT",
    elapsed: 90,
    venue_name: "Atanasio Girardot",
    venue_city: "Medellin",
    home_team_api_id: 1,
    away_team_api_id: 2,
    goals_home: 2,
    goals_away: 1,
  };
  const match = mapFootballFixtureToInternalMatch(fixture, {
    teamsById: new Map([
      [1, { api_football_team_id: 1, name: "Atlético Nacional", logo_url: "/nacional.svg" }],
      [2, { api_football_team_id: 2, name: "Deportivo Cali", logo_url: "/cali.svg" }],
    ]),
    competitionsById: new Map([[239, { api_football_league_id: 239, name: "Liga BetPlay" }]]),
    partidosByFixtureId: new Map([[101, { id: 55, local_corto: "NAC", visitante_corto: "CAL" }]]),
  });

  assert.equal(match.id, 55);
  assert.equal(match.source, "football_fixtures");
  assert.equal(match.externalId, 101);
  assert.equal(match.leagueName, "Liga BetPlay");
  assert.equal(match.homeTeamName, "Atlético Nacional");
  assert.equal(match.homeLogoUrl, "/nacional.svg");
  assert.equal(match.status, "finalizado");
  assert.equal(match.homeScore, 2);
  assert.equal(match.venue, "Atanasio Girardot · Medellin");
});

test("mapPartidoToInternalMatch normaliza formato legacy partidos", () => {
  const match = mapPartidoToInternalMatch({
    id: 7,
    api_football_fixture_id: 101,
    torneo: "Liga BetPlay",
    temporada: 2026,
    local_nombre: "Atl. Nacional",
    visitante_nombre: "Deportivo Cali",
    fecha_orden: "2026-07-08T20:00:00Z",
    estado: "en_vivo",
    minuto: 35,
  });

  assert.equal(match.id, 7);
  assert.equal(match.source, "partidos");
  assert.equal(match.status, "en_vivo");
  assert.equal(match.elapsed, 35);
  assert.equal(match.homeTeamName, "Atl. Nacional");
});

test("adaptInternalMatchToPartidoRow mantiene compatibilidad de pantallas actuales", () => {
  const row = adaptInternalMatchToPartidoRow({
    id: 9,
    source: "football_fixtures",
    externalId: 101,
    leagueId: 239,
    leagueName: "Liga BetPlay",
    season: 2026,
    homeTeamName: "Atlético Nacional",
    awayTeamName: "Deportivo Cali",
    homeLogoUrl: "/nacional.svg",
    awayLogoUrl: "/cali.svg",
    kickoffAt: "2026-07-08T20:00:00Z",
    displayDate: "8 jul 2026",
    status: "finalizado",
    homeScore: 2,
    awayScore: 1,
    round: "Fecha 1",
    elapsed: 90,
    legacy: { local_corto: "NAC", visitante_corto: "CAL", es_relevante: true },
  });

  assert.equal(row.id, 9);
  assert.equal(row.api_football_fixture_id, 101);
  assert.equal(row.local_nombre, "Atlético Nacional");
  assert.equal(row.local_logo_url, "/nacional.svg");
  assert.equal(row.goles_local_final, 2);
  assert.equal(row.local_corto, "NAC");
});

test("adaptInternalMatchToDetailPartido conserva id legacy para rutas y pronosticos", () => {
  const detail = adaptInternalMatchToDetailPartido({
    id: 77,
    source: "football_fixtures",
    externalId: 1001,
    leagueId: 239,
    leagueName: "Liga BetPlay",
    season: 2026,
    homeTeamName: "Atlético Nacional",
    awayTeamName: "Deportivo Cali",
    homeLogoUrl: "/nacional.svg",
    awayLogoUrl: null,
    kickoffAt: "2026-07-08T20:00:00Z",
    displayDate: "8 jul 2026",
    status: "finalizado",
    homeScore: 2,
    awayScore: 1,
    venue: "Atanasio Girardot",
    round: "Fecha 1",
    elapsed: 90,
    legacy: {
      id: 77,
      local_corto: "NAC",
      visitante_corto: "CAL",
      origen_datos: "api_football",
      fuente_detalle: "api-football",
    },
  });

  assert.equal(detail.id, 77);
  assert.equal(detail.apiFootballFixtureId, 1001);
  assert.equal(detail.source, "football_fixtures");
  assert.equal(detail.local, "Atlético Nacional");
  assert.equal(detail.visitante, "Deportivo Cali");
  assert.equal(detail.localLogoUrl, "/nacional.svg");
  assert.deepEqual(detail.resultadoFinal, { local: 2, visitante: 1 });
  assert.equal(detail.venue, "Atanasio Girardot");
  assert.equal(detail.legacyPartido.id, 77);
});

test("adaptInternalMatchToDetailPartido soporta datos faltantes sin inventar", () => {
  const detail = adaptInternalMatchToDetailPartido({
    id: 88,
    source: "partidos",
    externalId: null,
    leagueName: "Liga BetPlay",
    homeTeamName: "Equipo A",
    awayTeamName: "Equipo B",
    kickoffAt: null,
    status: "proximo",
    homeScore: null,
    awayScore: null,
    legacy: { id: 88 },
  });

  assert.equal(detail.id, 88);
  assert.equal(detail.apiFootballFixtureId, null);
  assert.equal(detail.resultadoFinal, null);
  assert.equal(detail.localLogoUrl, undefined);
  assert.equal(detail.fechaOrden, null);
});

test("selectFootballSourceRows usa fixtures cuando hay datos y fallback partidos cuando no", () => {
  assert.deepEqual(selectFootballSourceRows([{ id: 1 }], [{ id: 2 }]), {
    source: "football_fixtures",
    rows: [{ id: 1 }],
  });
  assert.deepEqual(selectFootballSourceRows([], [{ id: 2 }]), {
    source: "partidos",
    rows: [{ id: 2 }],
  });
  assert.deepEqual(selectFootballSourceRows(null, null), {
    source: "partidos",
    rows: [],
  });
});

function createQuery(data) {
  return {
    select() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data, error: null }); },
    in() { return Promise.resolve({ data, error: null }); },
  };
}

test("obtenerPronosticosModelo mapea predicciones del modelo para la UI", async () => {
  const predictions = [
    {
      api_football_fixture_id: 1001,
      partido_id: "p-1",
      home_win_probability: 0.52,
      draw_probability: 0.24,
      away_win_probability: 0.24,
      expected_home_goals: 1.8,
      expected_away_goals: 1.1,
      predicted_home_goals: 2,
      predicted_away_goals: 1,
      confidence: 0.52,
      model_version: "poisson-elo-v1",
      generated_at: "2026-07-10T00:00:00Z",
    },
  ];
  const matches = [
    {
      id: "p-1",
      api_football_fixture_id: 1001,
      torneo: "Premier League",
      fecha_orden: "2026-08-10T19:00:00Z",
      local_nombre: "Arsenal",
      visitante_nombre: "Chelsea",
    },
  ];
  const client = {
    from(table) {
      return createQuery(table === "model_predictions" ? predictions : matches);
    },
  };

  const result = await obtenerPronosticosModelo({ limit: 1, freeLimit: 1 }, client);

  assert.equal(result.length, 1);
  assert.equal(result[0].liga, "Premier League");
  assert.equal(result[0].local, "Arsenal");
  assert.equal(result[0].pHome, 0.52);
  assert.equal(result[0].predictedOutcomeLabel, "Local");
  assert.equal(result[0].probableScore, "2-1");
  assert.equal(result[0].accessTier, "free");
});

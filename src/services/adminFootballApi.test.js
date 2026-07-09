import assert from "node:assert/strict";
import test from "node:test";
import {
  obtenerEstadoSincronizacionFootball,
  obtenerPartidosAdminConFiltros,
  obtenerResumenYCalidadAdminPartidos,
} from "./adminFootballApi.js";

function queryResponse(data, error = null) {
  return {
    select() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data, error }); },
    in() { return Promise.resolve({ data, error }); },
  };
}

function crearClienteFake(tablas = {}, rpcs = {}) {
  return {
    from(table) {
      const value = tablas[table] || { data: [], error: null };
      return queryResponse(value.data, value.error);
    },
    rpc(name) {
      const value = rpcs[name] || { data: { runs: [], summary: {}, config: {} }, error: null };
      return Promise.resolve(value);
    },
  };
}

test("obtenerResumenYCalidadAdminPartidos usa fallback cuando una consulta no devuelve datos", async () => {
  const client = crearClienteFake({
    partidos: { data: [{ id: 1, estado: "proximo", api_football_fixture_id: null }] },
    football_fixtures: { data: [], error: new Error("missing table") },
    football_teams: { data: [] },
    model_predictions: { data: [] },
  });

  const { resumen, calidad } = await obtenerResumenYCalidadAdminPartidos(client);

  assert.equal(resumen.totalPartidosLegacy, 1);
  assert.equal(resumen.totalFixtures, 0);
  assert.equal(resumen.estadoGeneral, "error");
  assert.equal(calidad.mensaje, "No se pudo cargar el resumen admin.");
});

test("obtenerPartidosAdminConFiltros combina fixtures y legacy", async () => {
  const client = crearClienteFake({
    partidos: {
      data: [{
        id: 7,
        torneo: "Liga BetPlay",
        fecha_orden: "2026-07-08T20:00:00Z",
        local_nombre: "A",
        visitante_nombre: "B",
        estado: "proximo",
        api_football_fixture_id: 101,
      }],
    },
    football_fixtures: {
      data: [{
        api_football_fixture_id: 101,
        competition_api_id: 239,
        kickoff_at: "2026-07-08T20:00:00Z",
        status_short: "NS",
        home_team_api_id: 1,
        away_team_api_id: 2,
      }],
    },
    football_teams: {
      data: [
        { api_football_team_id: 1, name: "A", logo_url: "/a.svg" },
        { api_football_team_id: 2, name: "B", logo_url: "/b.svg" },
      ],
    },
    football_competitions: { data: [{ api_football_league_id: 239, name: "Liga BetPlay" }] },
  });

  const partidos = await obtenerPartidosAdminConFiltros({ limit: 10 }, client);

  assert.equal(partidos.length, 1);
  assert.equal(partidos[0].id, 7);
  assert.equal(partidos[0].adminReadOnly, false);
  assert.equal(partidos[0].localLogoUrl, "/a.svg");
});

test("obtenerEstadoSincronizacionFootball maneja monitor fallido", async () => {
  const client = crearClienteFake({}, {
    obtener_api_football_monitor: { data: null, error: new Error("rpc failed") },
  });

  const estado = await obtenerEstadoSincronizacionFootball(client);

  assert.equal(estado.nivel, "error");
  assert.equal(estado.runs.length, 0);
});

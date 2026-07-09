import assert from "node:assert/strict";
import test from "node:test";
import {
  construirCalidadDatosPartidos,
  construirListadoAdmin,
  construirResumenAdminPartidos,
  normalizarEstadoSincronizacionFootball,
} from "./adminFootballMappers.js";

const partidoLegacy = {
  id: 7,
  torneo: "Liga BetPlay",
  fecha_orden: "2026-07-08T20:00:00Z",
  local_nombre: "Atlético Nacional",
  visitante_nombre: "Deportivo Cali",
  estado: "proximo",
  es_relevante: true,
  prioridad_visual: 10,
  api_football_fixture_id: 101,
};

const fixture = {
  api_football_fixture_id: 101,
  competition_api_id: 239,
  season_start_year: 2026,
  round: "Fecha 1",
  kickoff_at: "2026-07-08T20:00:00Z",
  status_short: "NS",
  home_team_api_id: 1,
  away_team_api_id: 2,
};

const teams = [
  { api_football_team_id: 1, name: "Atlético Nacional", logo_url: "/nacional.svg" },
  { api_football_team_id: 2, name: "Deportivo Cali", logo_url: null },
];

const competitions = [
  { api_football_league_id: 239, name: "Liga BetPlay", country: "Colombia" },
];

test("resumen admin soporta solo partidos legacy", () => {
  const resumen = construirResumenAdminPartidos({ partidos: [{ ...partidoLegacy, api_football_fixture_id: null }] });

  assert.equal(resumen.totalPartidosLegacy, 1);
  assert.equal(resumen.totalFixtures, 0);
  assert.equal(resumen.partidosSinFixture, 1);
  assert.equal(resumen.estadoGeneral, "ok");
});

test("resumen admin cuenta fixtures vinculados con partidos", () => {
  const resumen = construirResumenAdminPartidos({ partidos: [partidoLegacy], fixtures: [fixture], teams });

  assert.equal(resumen.totalFixtures, 1);
  assert.equal(resumen.fixturesVinculados, 1);
  assert.equal(resumen.fixturesSinVinculo, 0);
  assert.equal(resumen.equiposSinLogo, 1);
  assert.equal(resumen.estadoGeneral, "warning");
});

test("resumen admin detecta fixtures sin vinculo legacy", () => {
  const resumen = construirResumenAdminPartidos({ partidos: [], fixtures: [fixture], teams });

  assert.equal(resumen.fixturesSinVinculo, 1);
  assert.equal(resumen.estadoGeneral, "warning");
});

test("resumen admin detecta partidos sin fixture", () => {
  const resumen = construirResumenAdminPartidos({
    partidos: [{ ...partidoLegacy, api_football_fixture_id: null }],
    fixtures: [fixture],
    teams,
  });

  assert.equal(resumen.partidosSinFixture, 1);
  assert.equal(resumen.fixturesSinVinculo, 1);
});

test("calidad de datos avisa equipos sin logo", () => {
  const calidad = construirCalidadDatosPartidos(
    construirResumenAdminPartidos({ partidos: [partidoLegacy], fixtures: [fixture], teams })
  );

  assert.equal(calidad.nivel, "warning");
  assert.match(calidad.mensaje, /Datos incompletos/);
  assert.ok(calidad.detalles.some((detalle) => detalle.includes("equipos sin logo")));
});

test("calidad de datos queda unknown sin datos", () => {
  const calidad = construirCalidadDatosPartidos(construirResumenAdminPartidos());

  assert.equal(calidad.nivel, "unknown");
  assert.equal(calidad.mensaje, "No hay partidos cargados todavía.");
});

test("listado admin incluye fixture sin vinculo como solo lectura", () => {
  const listado = construirListadoAdmin({ fixtures: [fixture], teams, competitions });

  assert.equal(listado[0].id, "fixture-101");
  assert.equal(listado[0].adminReadOnly, true);
  assert.equal(listado[0].local_nombre, "Atlético Nacional");
  assert.equal(listado[0].torneo, "Liga BetPlay");
});

test("estado sync sin runs es unknown", () => {
  const estado = normalizarEstadoSincronizacionFootball({ runs: [], summary: {}, config: {} });

  assert.equal(estado.nivel, "unknown");
  assert.equal(estado.mensaje, "No hay registros de sincronización.");
});

test("estado sync exitoso es ok", () => {
  const estado = normalizarEstadoSincronizacionFootball({
    runs: [{ id: 1, status: "success", started_at: "2026-07-08T20:00:00Z" }],
  });

  assert.equal(estado.nivel, "ok");
  assert.equal(estado.ultimoSync.status, "success");
});

test("estado sync fallido es error", () => {
  const estado = normalizarEstadoSincronizacionFootball({
    runs: [{ id: 1, status: "error", error_message: "quota" }],
  });

  assert.equal(estado.nivel, "error");
});

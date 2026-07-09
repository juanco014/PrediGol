import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEstadisticasUsuario,
  crearEstadisticasVacias,
  mapPronosticoConPartido,
  uniqueFinishedTournaments,
} from "./predictionStatsMappers.js";

test("mapPronosticoConPartido conserva partidoId legacy y calcula puntos", () => {
  const result = mapPronosticoConPartido(
    { id: 10, usuario_id: "u1", partido_id: 7, goles_local: 2, goles_visitante: 1 },
    {
      id: 7,
      api_football_fixture_id: 101,
      torneo: "Liga BetPlay",
      local_nombre: "Atlético Nacional",
      visitante_nombre: "Deportivo Cali",
      fecha_orden: "2026-07-08T20:00:00Z",
      estado: "finalizado",
      goles_local_final: 2,
      goles_visitante_final: 1,
      local_logo_url: "/nacional.svg",
    }
  );

  assert.equal(result.id, 7);
  assert.equal(result.partidoId, 7);
  assert.equal(result.fixtureId, 101);
  assert.equal(result.puntos, 5);
  assert.equal(result.acierto, true);
  assert.equal(result.localLogoUrl, "/nacional.svg");
});

test("buildEstadisticasUsuario devuelve estadisticas vacias sin datos", () => {
  assert.deepEqual(buildEstadisticasUsuario([], []), crearEstadisticasVacias());
});

test("buildEstadisticasUsuario calcula aciertos sin cambiar reglas", () => {
  const stats = buildEstadisticasUsuario(
    [
      { partido_id: 1, goles_local: 1, goles_visitante: 0 },
      { partido_id: 2, goles_local: 0, goles_visitante: 0 },
    ],
    [
      {
        id: 1,
        torneo: "Liga BetPlay",
        local_nombre: "A",
        visitante_nombre: "B",
        fecha_orden: "2026-07-08T20:00:00Z",
        estado: "finalizado",
        goles_local_final: 1,
        goles_visitante_final: 0,
      },
      {
        id: 2,
        torneo: "Liga BetPlay",
        local_nombre: "C",
        visitante_nombre: "D",
        fecha_orden: "2026-07-07T20:00:00Z",
        estado: "finalizado",
        goles_local_final: 2,
        goles_visitante_final: 1,
      },
    ]
  );

  assert.equal(stats.totalPronosticos, 2);
  assert.equal(stats.puntosTotales, 5);
  assert.equal(stats.aciertos, 1);
  assert.equal(stats.porcentajeAciertos, 50);
});

test("buildEstadisticasUsuario ignora pronosticos sin partido vinculado", () => {
  const stats = buildEstadisticasUsuario(
    [{ partido_id: 999, goles_local: 1, goles_visitante: 1 }],
    []
  );

  assert.equal(stats.totalPronosticos, 0);
});

test("uniqueFinishedTournaments normaliza lista desde fallback legacy", () => {
  assert.deepEqual(
    uniqueFinishedTournaments([
      { torneo: "Liga BetPlay" },
      { torneo: "Copa Libertadores" },
      { torneo: "Liga BetPlay" },
      { torneo: "" },
    ]),
    ["Copa Libertadores", "Liga BetPlay"]
  );
});

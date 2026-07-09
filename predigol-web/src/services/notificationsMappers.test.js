import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptarPartidoNotificacion,
  construirAvisosPartidos,
  mapPronosticosByPartido,
} from "./notificationsMappers.js";

const preferences = {
  reminder_24h: true,
  reminder_1h: true,
  kickoff_updates: true,
  result_updates: true,
  favorite_updates: true,
};

const favorites = {
  isTeamFavorite: (name) => name === "Atlético Nacional",
  isCompetitionFavorite: () => false,
};

test("adaptarPartidoNotificacion conserva partidoId legacy y logos", () => {
  const partido = adaptarPartidoNotificacion({
    id: 7,
    api_football_fixture_id: 101,
    torneo: "Liga BetPlay",
    fecha_orden: "2026-07-08T20:00:00Z",
    local_nombre: "Atlético Nacional",
    visitante_nombre: "Deportivo Cali",
    local_logo_url: "/nacional.svg",
    visitante_logo_url: "/cali.svg",
    estado: "finalizado",
    goles_local_final: 2,
    goles_visitante_final: 1,
  });

  assert.equal(partido.id, 7);
  assert.equal(partido.partidoId, 7);
  assert.equal(partido.fixtureId, 101);
  assert.deepEqual(partido.resultadoFinal, { local: 2, visitante: 1 });
  assert.equal(partido.homeLogoUrl, "/nacional.svg");
});

test("mapPronosticosByPartido indexa pronosticos por partido_id", () => {
  assert.deepEqual(
    mapPronosticosByPartido([{ partido_id: 7, goles_local: 1, goles_visitante: 0 }]),
    { 7: { local: 1, visitante: 0 } }
  );
});

test("construirAvisosPartidos genera aviso urgente sin pronostico", () => {
  const ahora = new Date("2026-07-08T19:30:00Z");
  const avisos = construirAvisosPartidos(
    [
      adaptarPartidoNotificacion({
        id: 7,
        torneo: "Liga BetPlay",
        fecha_orden: "2026-07-08T20:00:00Z",
        local_nombre: "Atlético Nacional",
        visitante_nombre: "Deportivo Cali",
        estado: "proximo",
        goles_local_final: null,
        goles_visitante_final: null,
      }),
    ],
    {},
    ahora,
    preferences,
    favorites
  );

  assert.equal(avisos[0].id, "pending-1h-7");
  assert.equal(avisos[0].partidoId, 7);
  assert.equal(avisos[0].tipo, "pending-urgent");
  assert.equal(avisos[0].favorito, true);
});

test("construirAvisosPartidos genera resultado con puntos", () => {
  const avisos = construirAvisosPartidos(
    [
      adaptarPartidoNotificacion({
        id: 8,
        torneo: "Liga BetPlay",
        fecha_orden: "2026-07-07T20:00:00Z",
        local_nombre: "Atlético Nacional",
        visitante_nombre: "Deportivo Cali",
        estado: "finalizado",
        goles_local_final: 2,
        goles_visitante_final: 1,
      }),
    ],
    { 8: { local: 2, visitante: 1 } },
    new Date("2026-07-08T20:00:00Z"),
    preferences,
    favorites
  );

  assert.equal(avisos[0].tipo, "result-win");
  assert.match(avisos[0].titulo, /Sumaste/);
  assert.equal(avisos[0].partidoId, 8);
});

test("construirAvisosPartidos tolera preferencias y favoritos vacios", () => {
  assert.deepEqual(
    construirAvisosPartidos(
      [
        adaptarPartidoNotificacion({
          id: 9,
          torneo: "Liga BetPlay",
          fecha_orden: "2026-07-08T20:00:00Z",
          local_nombre: "A",
          visitante_nombre: "B",
          estado: "en_vivo",
        }),
      ],
      undefined,
      new Date("2026-07-08T20:00:00Z"),
      undefined,
      undefined
    ),
    []
  );
});

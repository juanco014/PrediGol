import assert from "node:assert/strict";
import test from "node:test";
import {
  mapDetalleLiga,
  mapLigaPrivada,
  mapLigasPrivadas,
  mapRankingLiga,
  normalizarCodigoLiga,
} from "./privateLeaguesMappers.js";

test("mapLigaPrivada normaliza liga basica y conserva id para rutas", () => {
  const liga = mapLigaPrivada(
    {
      id: 12,
      nombre: "Amigos del barrio",
      codigo: "prediabc23",
      participantes: 4,
      creador_id: "u1",
    },
    "u2"
  );

  assert.equal(liga.id, 12);
  assert.equal(liga.nombre, "Amigos del barrio");
  assert.equal(liga.codigo, "prediabc23");
  assert.equal(liga.codigoInvitacion, "prediabc23");
  assert.equal(liga.participantes, 4);
  assert.equal(liga.totalMiembros, 4);
  assert.equal(liga.esOwner, false);
  assert.equal(liga.esMiembro, true);
});

test("mapLigaPrivada soporta liga sin descripcion y usuario owner", () => {
  const liga = mapLigaPrivada(
    {
      id: "liga-1",
      nombre: "Copa privada",
      codigo_invitacion: "PREDI12345",
      owner_id: "u1",
    },
    "u1"
  );

  assert.equal(liga.descripcion, "");
  assert.equal(liga.codigo, "PREDI12345");
  assert.equal(liga.ownerId, "u1");
  assert.equal(liga.esOwner, true);
});

test("mapLigasPrivadas conserva lista vacia", () => {
  assert.deepEqual(mapLigasPrivadas([], "u1"), []);
});

test("mapRankingLiga normaliza ranking vacio y jugador actual", () => {
  assert.deepEqual(mapRankingLiga([], "u1"), []);

  const ranking = mapRankingLiga(
    [{ usuario_id: "u1", nombre: "Ana", puntos: "8", aciertos: "2" }],
    "u1"
  );

  assert.equal(ranking[0].usuarioId, "u1");
  assert.equal(ranking[0].posicion, 1);
  assert.equal(ranking[0].puntos, 8);
  assert.equal(ranking[0].aciertos, 2);
  assert.equal(ranking[0].esUsuarioActual, true);
});

test("mapDetalleLiga arma estructura reusable con miembros vacios", () => {
  const detalle = mapDetalleLiga(
    { id: 3, nombre: "Liga", codigo: "PREDI99999", participantes: 0 },
    [],
    "u1"
  );

  assert.equal(detalle.liga.id, 3);
  assert.deepEqual(detalle.miembros, []);
  assert.deepEqual(detalle.ranking, []);
  assert.deepEqual(detalle.pronosticos, []);
  assert.deepEqual(detalle.invitacion, { codigo: "PREDI99999" });
  assert.equal(detalle.permisos.esMiembro, true);
});

test("normalizarCodigoLiga limpia codigo de invitacion", () => {
  assert.equal(normalizarCodigoLiga(" prediabc23 "), "PREDIABC23");
  assert.equal(normalizarCodigoLiga(""), "");
});

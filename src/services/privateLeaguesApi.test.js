import assert from "node:assert/strict";
import test from "node:test";
import {
  crearLigaPrivada,
  obtenerDetalleLiga,
  obtenerLigasUsuario,
  obtenerMensajeErrorLiga,
  unirseALigaPorCodigo,
} from "./privateLeaguesApi.js";

function crearInsertBuilder(response) {
  return {
    insert(payload) {
      response.insertPayloads.push(payload);
      return this;
    },
    upsert(payload, options) {
      response.upsertPayloads.push({ payload, options });
      return Promise.resolve(response.upsertResult || { error: null });
    },
    select() {
      return this;
    },
    single() {
      return Promise.resolve(response.singleResults.shift());
    },
    eq(_field, value) {
      response.eqValue = value;
      return this;
    },
    maybeSingle() {
      return Promise.resolve(response.maybeSingleResult);
    },
  };
}

function crearClienteFake({ rpcs = {}, ligas = {}, miembros = {} } = {}) {
  return {
    rpc(name, params) {
      const value = rpcs[name] || { data: [], error: null };
      value.params = params;
      return Promise.resolve(value);
    },
    from(table) {
      if (table === "ligas") return crearInsertBuilder(ligas);
      if (table === "liga_miembros") return crearInsertBuilder(miembros);
      throw new Error(`Tabla inesperada: ${table}`);
    },
  };
}

test("obtenerLigasUsuario devuelve lista vacia sin usuario", async () => {
  const result = await obtenerLigasUsuario(null, crearClienteFake());

  assert.deepEqual(result, []);
});

test("obtenerLigasUsuario usa RPC y mapea ligas", async () => {
  const client = crearClienteFake({
    rpcs: {
      obtener_mis_ligas: {
        data: [{ id: 1, nombre: "Liga", codigo: "PREDI12345", participantes: 2 }],
        error: null,
      },
    },
  });

  const result = await obtenerLigasUsuario("u1", client);

  assert.equal(result[0].id, 1);
  assert.equal(result[0].codigo, "PREDI12345");
  assert.equal(result[0].participantes, 2);
});

test("crearLigaPrivada crea liga y agrega owner como miembro", async () => {
  const ligas = {
    insertPayloads: [],
    upsertPayloads: [],
    singleResults: [
      { data: { id: 5, nombre: "Liga Nueva", codigo: "PREDIABCDE" }, error: null },
    ],
  };
  const miembros = { insertPayloads: [], upsertPayloads: [] };
  const client = crearClienteFake({ ligas, miembros });

  const result = await crearLigaPrivada(
    { nombre: " Liga Nueva ", usuarioId: "u1" },
    client,
    () => "PREDIABCDE"
  );

  assert.equal(result.id, 5);
  assert.equal(result.codigo, "PREDIABCDE");
  assert.equal(ligas.insertPayloads[0].nombre, "Liga Nueva");
  assert.equal(ligas.insertPayloads[0].creador_id, "u1");
  assert.equal(miembros.upsertPayloads[0].payload.liga_id, 5);
  assert.equal(miembros.upsertPayloads[0].payload.usuario_id, "u1");
});

test("crearLigaPrivada reintenta codigo duplicado", async () => {
  const ligas = {
    insertPayloads: [],
    upsertPayloads: [],
    singleResults: [
      { data: null, error: { code: "23505", message: "duplicado" } },
      { data: { id: 6, nombre: "Liga", codigo: "PREDI22222" }, error: null },
    ],
  };
  const miembros = { insertPayloads: [], upsertPayloads: [] };
  const client = crearClienteFake({ ligas, miembros });
  const codigos = ["PREDI11111", "PREDI22222"];

  const result = await crearLigaPrivada(
    { nombre: "Liga", usuarioId: "u1" },
    client,
    () => codigos.shift()
  );

  assert.equal(result.codigo, "PREDI22222");
  assert.equal(ligas.insertPayloads.length, 2);
});

test("unirseALigaPorCodigo rechaza codigo vacio", async () => {
  await assert.rejects(
    () => unirseALigaPorCodigo(" ", "u1", crearClienteFake()),
    /Ingresa el código/
  );
});

test("unirseALigaPorCodigo informa codigo invalido", async () => {
  const client = crearClienteFake({
    ligas: {
      insertPayloads: [],
      upsertPayloads: [],
      maybeSingleResult: { data: null, error: null },
    },
  });

  await assert.rejects(
    () => unirseALigaPorCodigo("PREDI00000", "u1", client),
    /No encontramos una liga/
  );
});

test("unirseALigaPorCodigo conserva id de liga encontrada", async () => {
  const ligas = {
    insertPayloads: [],
    upsertPayloads: [],
    maybeSingleResult: {
      data: { id: 9, nombre: "Liga existente", codigo: "PREDIABCDE" },
      error: null,
    },
  };
  const miembros = { insertPayloads: [], upsertPayloads: [] };
  const client = crearClienteFake({ ligas, miembros });

  const result = await unirseALigaPorCodigo(" prediabcde ", "u2", client);

  assert.equal(result.id, 9);
  assert.equal(ligas.eqValue, "PREDIABCDE");
  assert.equal(miembros.insertPayloads[0].liga_id, 9);
  assert.equal(miembros.insertPayloads[0].usuario_id, "u2");
});

test("obtenerDetalleLiga combina detalle y ranking vacio", async () => {
  const client = crearClienteFake({
    rpcs: {
      obtener_detalle_liga: {
        data: [{ id: 3, nombre: "Liga", codigo: "PREDI12345", participantes: 0 }],
        error: null,
      },
      obtener_ranking_liga: { data: [], error: null },
    },
  });

  const result = await obtenerDetalleLiga(3, "u1", client);

  assert.equal(result.liga.id, 3);
  assert.deepEqual(result.ranking, []);
  assert.deepEqual(result.miembros, []);
});

test("obtenerMensajeErrorLiga convierte error de permisos en mensaje amigable", () => {
  assert.equal(
    obtenerMensajeErrorLiga(new Error("permission denied for table ligas")),
    "No tienes permisos para ver esta liga."
  );
});

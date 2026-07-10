import assert from "node:assert/strict";
import test from "node:test";
import {
  activarPremiumManualAdmin,
  normalizarDatasetAdmin,
  normalizarModelRunAdmin,
  normalizarPrediccionAdmin,
  obtenerPrediccionesAdmin,
  obtenerResumenAdmin,
  obtenerUsuariosPremiumAdmin,
} from "./adminApi.js";

function queryResponse(data, error = null, calls = []) {
  return {
    select(columns) { calls.push(["select", columns]); return this; },
    order(column, options) { calls.push(["order", column, options]); return this; },
    limit(value) { calls.push(["limit", value]); return Promise.resolve({ data, error }); },
    in(column, values) { calls.push(["in", column, values]); return Promise.resolve({ data, error }); },
    insert(payload) { calls.push(["insert", payload]); this.payload = payload; return this; },
    single() { calls.push(["single"]); return Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }); },
  };
}

function crearClienteFake(tablas = {}, rpcs = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(["from", table]);
      const value = tablas[table] || { data: [], error: null };
      return queryResponse(value.data, value.error, calls);
    },
    rpc(name) {
      calls.push(["rpc", name]);
      const value = rpcs[name] || { data: {}, error: null };
      return Promise.resolve(value);
    },
  };
}

test("normalizadores admin exponen V1/V2, datasets y runs sin cambiar modelos", () => {
  const dataset = normalizarDatasetAdmin({ name: "LaLiga 2022", competition: "LaLiga", season: 2022, source_type: "api", source_name: "api-football", valid_matches: 380, total_matches: 380, status: "validated" });
  const run = normalizarModelRunAdmin({ model_version: "poisson-elo-v1", run_type: "prediction", status: "completed", used_matches: 12, available_matches: 20, metrics: { brier_score: 0.21 } });

  assert.equal(dataset.league, "LaLiga");
  assert.equal(dataset.source, "api - api-football");
  assert.equal(run.modelVersion, "poisson-elo-v1");
  assert.equal(run.brierScore, 0.21);
});

test("normalizarPrediccionAdmin calcula principal y conserva gratis/premium", () => {
  const prediccion = normalizarPrediccionAdmin({
    api_football_fixture_id: 10,
    home_win_probability: 0.51,
    draw_probability: 0.22,
    away_win_probability: 0.27,
    predicted_home_goals: 2,
    predicted_away_goals: 1,
    confidence: 0.64,
    model_version: "poisson-elo-v1",
    access_tier: "premium",
  }, { torneo: "LaLiga", local_nombre: "A", visitante_nombre: "B" });

  assert.equal(prediccion.predictedOutcomeLabel, "Local");
  assert.equal(prediccion.probableScore, "2-1");
  assert.equal(prediccion.accessTier, "premium");
});

test("obtenerResumenAdmin arma dashboard operativo con advertencias MVP", async () => {
  const client = crearClienteFake({
    model_datasets: { data: [{ id: "d1", name: "Dataset", valid_matches: 10 }] },
    model_runs: { data: [{ id: "r1", model_version: "poisson-elo-v1", run_type: "prediction", status: "completed" }] },
    model_predictions: { data: [{ api_football_fixture_id: 1, access_tier: "free" }, { api_football_fixture_id: 2, access_tier: "premium" }] },
    profiles: { data: [{ id: "u1", nombre: "Ana" }, { id: "u2", nombre: "Luis" }] },
    user_subscriptions: { data: [{ user_id: "u1", plan_code: "premium", status: "premium_active", metadata: { source: "manual_admin" } }] },
    partidos: { data: [{ id: 1, estado: "proximo" }] },
  }, {
    obtener_model_admin_summary: { data: { settings: { active_model: "V1" } }, error: null },
  });

  const resumen = await obtenerResumenAdmin({}, client);

  assert.equal(resumen.model.production, "poisson-elo-v1");
  assert.equal(resumen.model.experimental, "poisson-elo-form-v2");
  assert.equal(resumen.counts.predictions, 2);
  assert.equal(resumen.counts.premiumPredictions, 1);
  assert.equal(resumen.counts.premiumUsers, 1);
  assert.equal(resumen.counts.freeUsers, 1);
  assert.match(resumen.warnings.join(" "), /V2 experimental/);
});

test("obtenerPrediccionesAdmin combina model_predictions con partidos", async () => {
  const client = crearClienteFake({
    model_predictions: { data: [{ api_football_fixture_id: 100, home_win_probability: 0.4, draw_probability: 0.3, away_win_probability: 0.3, predicted_home_goals: 1, predicted_away_goals: 1, model_version: "poisson-elo-v1", access_tier: "free" }] },
    partidos: { data: [{ id: "p1", api_football_fixture_id: 100, torneo: "Liga", local_nombre: "Local", visitante_nombre: "Visita" }] },
  });

  const predicciones = await obtenerPrediccionesAdmin({}, client);

  assert.equal(predicciones.length, 1);
  assert.equal(predicciones[0].home, "Local");
  assert.equal(predicciones[0].modelVersion, "poisson-elo-v1");
});

test("obtenerUsuariosPremiumAdmin normaliza usuarios gratis y premium", async () => {
  const client = crearClienteFake({
    profiles: { data: [{ id: "u1", nombre: "Ana", rol: "admin" }, { id: "u2", nombre: "Luis", rol: "usuario" }] },
    user_subscriptions: { data: [{ user_id: "u1", plan_code: "premium", status: "premium_active", metadata: { source: "manual_admin" } }] },
  });

  const usuarios = await obtenerUsuariosPremiumAdmin({}, client);

  assert.equal(usuarios[0].isPremium, true);
  assert.equal(usuarios[0].source, "manual_admin");
  assert.equal(usuarios[1].status, "free");
});

test("activarPremiumManualAdmin inserta suscripcion manual sin pasarela", async () => {
  const client = crearClienteFake({
    user_subscriptions: { data: [{ id: "s1", user_id: "u1", plan_code: "premium", status: "premium_active" }] },
  });

  const result = await activarPremiumManualAdmin({ userId: "u1", days: 15, note: "MVP" }, client);

  assert.equal(result.plan_code, "premium");
  const insertCall = client.calls.find((call) => call[0] === "insert");
  assert.equal(insertCall[1].metadata.source, "manual_admin");
  assert.equal(insertCall[1].status, "premium_active");
});

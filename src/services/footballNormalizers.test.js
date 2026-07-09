import assert from "node:assert/strict";
import test from "node:test";
import {
  getTeamDisplayName,
  getTeamLogoUrl,
  getCanonicalTeamKey,
  mapExternalMatchToInternal,
  normalizeMatchStatus,
  normalizeTeamAlias,
  normalizeTeamCode,
  normalizeTeamName,
  normalizeTextKey,
  resolveTeamLogo,
} from "./footballNormalizers.js";

test("normalizeTeamName limpia tildes, separadores y mayusculas", () => {
  assert.equal(normalizeTeamName(" Atlético-Nacional S.A. "), "atletico nacional s a");
});

test("normalizeTextKey maneja null, mayusculas, puntos y espacios", () => {
  assert.equal(normalizeTextKey(null), "");
  assert.equal(normalizeTextKey(undefined), "");
  assert.equal(normalizeTextKey("  Atl.   Nacional!! "), "atl nacional");
  assert.equal(normalizeTextKey("AMÉRICA_de-Cali"), "america de cali");
});

test("normalizeTeamAlias resuelve alias seguros y conserva ambiguos", () => {
  assert.equal(normalizeTeamAlias("Atl. Nacional"), "atletico nacional");
  assert.equal(normalizeTeamAlias("DIM"), "deportivo independiente medellin");
  assert.equal(normalizeTeamAlias("Nacional"), "nacional");
  assert.equal(normalizeTeamAlias("America"), "america");
});

test("getCanonicalTeamKey devuelve clave canonica cuando es seguro", () => {
  assert.equal(getCanonicalTeamKey("Atl Nacional"), "atletico nacional");
  assert.equal(getCanonicalTeamKey("Atletico Nacional"), "atletico nacional");
});

test("normalizeTeamCode usa codigo explicito o iniciales seguras", () => {
  assert.equal(normalizeTeamCode(" nac "), "NAC");
  assert.equal(normalizeTeamCode("", "Deportivo Independiente Medellín"), "DIM");
});

test("normalizeMatchStatus mapea estados externos a estados internos", () => {
  assert.equal(normalizeMatchStatus("FT"), "finalizado");
  assert.equal(normalizeMatchStatus("1H"), "en_vivo");
  assert.equal(normalizeMatchStatus("CANC"), "cancelado");
  assert.equal(normalizeMatchStatus("NS"), "proximo");
});

test("mapExternalMatchToInternal no inventa datos y preserva payload", () => {
  const external = {
    fixture: { id: 123, date: "2026-07-08T20:00:00Z", status: { short: "FT" } },
    league: { id: 239, name: "Liga BetPlay", season: 2026, round: "Fecha 1" },
    teams: {
      home: { id: 1, name: "América de Cali", logo: "https://example.com/america.png" },
      away: { id: 2, name: "Deportivo Cali" },
    },
    goals: { home: 2, away: 1 },
  };

  const mapped = mapExternalMatchToInternal(external);

  assert.equal(mapped.external_id, 123);
  assert.equal(mapped.status, "finalizado");
  assert.equal(mapped.home_score, 2);
  assert.equal(mapped.away_score, 1);
  assert.equal(mapped.home_team.name, "América de Cali");
  assert.equal(mapped.away_team.logo_url, null);
  assert.equal(mapped.raw, external);
});

test("getTeamDisplayName y getTeamLogoUrl usan fallback seguro", () => {
  assert.equal(getTeamDisplayName({ code: "AME" }), "AME");
  assert.equal(getTeamDisplayName(null), "Equipo");
  assert.equal(getTeamLogoUrl({ logo_url: " https://example.com/logo.png " }), "https://example.com/logo.png");
  assert.equal(getTeamLogoUrl({ logo_url: "" }), null);
});

test("resolveTeamLogo prioriza logo directo", () => {
  const logos = new Map([["atletico nacional", "/logos/nacional.svg"]]);
  assert.equal(
    resolveTeamLogo("Atlético Nacional", logos, {}, " https://cdn.example.com/direct.svg "),
    "https://cdn.example.com/direct.svg"
  );
});

test("resolveTeamLogo encuentra logo por nombre exacto normalizado", () => {
  const logos = new Map([["atletico nacional", "/logos/nacional.svg"]]);
  assert.equal(resolveTeamLogo("Atlético Nacional", logos), "/logos/nacional.svg");
});

test("resolveTeamLogo encuentra logo por alias canonico", () => {
  const logos = new Map([["atletico nacional", "/logos/nacional.svg"]]);
  assert.equal(resolveTeamLogo("Atl. Nacional", logos), "/logos/nacional.svg");
});

test("resolveTeamLogo usa mapa local como fallback", () => {
  const fallback = { "Millonarios FC": "/logos/millonarios.svg" };
  assert.equal(resolveTeamLogo("Millonarios", new Map(), fallback), "/logos/millonarios.svg");
});

test("resolveTeamLogo retorna null sin logo o con alias ambiguo", () => {
  const logos = new Map([["atletico nacional", "/logos/nacional.svg"]]);
  assert.equal(resolveTeamLogo("Equipo sin logo", logos), null);
  assert.equal(resolveTeamLogo("Nacional", logos), null);
  assert.equal(resolveTeamLogo(null, logos), null);
});

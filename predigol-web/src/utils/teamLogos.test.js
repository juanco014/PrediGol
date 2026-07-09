import test from "node:test";
import assert from "node:assert/strict";
import { getTeamLogo, normalizeTeamLogoKey } from "./teamLogos.js";

const TEST_LOGOS = {
  "Atlético Nacional": "/teams/atletico-nacional.svg",
  "America de Cali": "/teams/america-de-cali.svg",
  "Millonarios FC": "/teams/millonarios.svg",
};

test("normalizeTeamLogoKey limpia tildes, simbolos y espacios", () => {
  assert.equal(normalizeTeamLogoKey("  Atlético-Nacional  "), "atletico nacional");
  assert.equal(normalizeTeamLogoKey("América_de Cali"), "america de cali");
  assert.equal(normalizeTeamLogoKey(null), "");
});

test("getTeamLogo resuelve nombres con tildes y mayusculas", () => {
  assert.equal(
    getTeamLogo("ATLETICO NACIONAL", TEST_LOGOS),
    "/teams/atletico-nacional.svg"
  );
  assert.equal(
    getTeamLogo("América de Cali", TEST_LOGOS),
    "/teams/america-de-cali.svg"
  );
});

test("getTeamLogo devuelve null si no hay logo verificado", () => {
  assert.equal(getTeamLogo("Equipo sin logo", TEST_LOGOS), null);
  assert.equal(getTeamLogo("", TEST_LOGOS), null);
});

test("getTeamLogo soporta variantes simples de separadores", () => {
  assert.equal(getTeamLogo("Millonarios-FC", TEST_LOGOS), "/teams/millonarios.svg");
});

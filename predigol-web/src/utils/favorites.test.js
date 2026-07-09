import test from "node:test";
import assert from "node:assert/strict";
import { normalizarClaveFavorito } from "./favorites.js";

test("normalizarClaveFavorito limpia acentos, espacios y mayusculas", () => {
  assert.equal(normalizarClaveFavorito("  Atlético Nacional  "), "atletico nacional");
  assert.equal(normalizarClaveFavorito(null), "");
});

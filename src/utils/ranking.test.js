import test from "node:test";
import assert from "node:assert/strict";
import { crearUsuarioRanking, obtenerRankingGlobal } from "./ranking.js";

test("crearUsuarioRanking normaliza puntos y aciertos", () => {
  assert.deepEqual(
    crearUsuarioRanking({ puntosTotales: "12", aciertos: "3", nombre: "Ana" }),
    {
      id: "usuario-actual",
      nombre: "Ana",
      usuario: "@hincha_predigol",
      puntos: 12,
      aciertos: 3,
      avatar: "J",
      esUsuarioActual: true,
    }
  );
});

test("obtenerRankingGlobal ordena por puntos y calcula posicion del usuario", () => {
  const usuario = crearUsuarioRanking({ puntosTotales: 15, aciertos: 2 });
  const resultado = obtenerRankingGlobal(usuario);

  assert.equal(resultado.posicionUsuario, 2);
  assert.equal(resultado.ranking[resultado.posicionUsuario - 1].id, "usuario-actual");
  assert.equal(resultado.puntosParaSubir, 4);
});

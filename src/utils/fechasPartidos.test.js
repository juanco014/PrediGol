import test from "node:test";
import assert from "node:assert/strict";
import { obtenerCuentaRegresiva } from "./fechasPartidos.js";

test("obtenerCuentaRegresiva devuelve texto y marca urgencia", () => {
  const cuenta = obtenerCuentaRegresiva(
    "2026-06-24T20:00:00",
    new Date("2026-06-24T18:30:00")
  );

  assert.equal(cuenta.texto, "Faltan 1 h 30 min");
  assert.equal(cuenta.urgente, true);
  assert.equal(cuenta.dentroDe72Horas, true);
});

test("obtenerCuentaRegresiva devuelve null con fechas invalidas o pasadas", () => {
  assert.equal(obtenerCuentaRegresiva("fecha-invalida"), null);
  assert.equal(
    obtenerCuentaRegresiva(
      "2026-06-24T18:00:00",
      new Date("2026-06-24T18:30:00")
    ),
    null
  );
});

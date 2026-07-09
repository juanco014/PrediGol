import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDetallePuntaje,
  obtenerEstadisticas,
  obtenerResultadoMarcador,
  partidoAceptaPronosticos,
} from "./estadisticas.js";

function mockLocalStorage(value) {
  globalThis.localStorage = {
    getItem() {
      return value;
    },
  };
}

test("obtenerResultadoMarcador identifica local, visitante y empate", () => {
  assert.equal(obtenerResultadoMarcador({ local: 2, visitante: 1 }), "local");
  assert.equal(obtenerResultadoMarcador({ local: 0, visitante: 3 }), "visitante");
  assert.equal(obtenerResultadoMarcador({ local: 1, visitante: 1 }), "empate");
  assert.equal(obtenerResultadoMarcador(null), null);
});

test("calcularDetallePuntaje entrega 5 puntos por marcador exacto", () => {
  assert.deepEqual(
    calcularDetallePuntaje({ local: 2, visitante: 3 }, { local: 2, visitante: 3 }),
    {
      puntos: 5,
      estado: "acertado",
      aciertaResultado: true,
      aciertaDiferencia: true,
      marcadorExacto: true,
    }
  );
});

test("calcularDetallePuntaje suma resultado y diferencia sin exacto", () => {
  const detalle = calcularDetallePuntaje(
    { local: 1, visitante: 3 },
    { local: 2, visitante: 4 }
  );

  assert.equal(detalle.puntos, 4);
  assert.equal(detalle.aciertaResultado, true);
  assert.equal(detalle.aciertaDiferencia, true);
  assert.equal(detalle.marcadorExacto, false);
});

test("partidoAceptaPronosticos solo permite proximos antes del inicio", () => {
  const ahora = new Date("2026-06-24T18:00:00");

  assert.equal(
    partidoAceptaPronosticos(
      { estado: "proximo", fechaOrden: "2026-06-24T19:30:00" },
      ahora
    ),
    true
  );
  assert.equal(
    partidoAceptaPronosticos(
      { estado: "proximo", fechaOrden: "2026-06-24T17:30:00" },
      ahora
    ),
    false
  );
  assert.equal(partidoAceptaPronosticos({ estado: "finalizado" }, ahora), false);
});

test("obtenerEstadisticas usa datos demo/fallback locales", () => {
  mockLocalStorage(JSON.stringify({ 1: { local: 2, visitante: 3 } }));

  const estadisticas = obtenerEstadisticas();

  assert.equal(estadisticas.totalPronosticos, 1);
  assert.equal(estadisticas.puntosTotales, 5);
  assert.equal(estadisticas.aciertos, 1);
  assert.equal(estadisticas.porcentajeAciertos, 100);
});

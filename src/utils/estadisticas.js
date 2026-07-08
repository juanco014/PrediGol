import partidos from "../mocks/partidos.js";

export const PUNTOS_PRONOSTICO = {
  RESULTADO: 3,
  DIFERENCIA_EXTRA: 1,
  MARCADOR_EXACTO: 5,
};

export function cargarPronosticos() {
  try {
    const datosGuardados = localStorage.getItem("predigol-pronosticos");

    return datosGuardados ? JSON.parse(datosGuardados) : {};
  } catch {
    return {};
  }
}

export function obtenerResultadoMarcador(marcador) {
  if (!marcador) {
    return null;
  }

  const golesLocal = Number(marcador.local);
  const golesVisitante = Number(marcador.visitante);

  if (!Number.isFinite(golesLocal) || !Number.isFinite(golesVisitante)) {
    return null;
  }

  const diferencia = golesLocal - golesVisitante;

  if (diferencia > 0) {
    return "local";
  }

  if (diferencia < 0) {
    return "visitante";
  }

  return "empate";
}

export function calcularDetallePuntaje(pronostico, resultadoFinal) {
  const detalleVacio = {
    puntos: 0,
    estado: "fallado",
    aciertaResultado: false,
    aciertaDiferencia: false,
    marcadorExacto: false,
  };

  if (!pronostico || !resultadoFinal) {
    return {
      ...detalleVacio,
      estado: "pendiente",
    };
  }

  const localPronostico = Number(pronostico.local);
  const visitantePronostico = Number(pronostico.visitante);

  const localFinal = Number(resultadoFinal.local);
  const visitanteFinal = Number(resultadoFinal.visitante);

  if (
    !Number.isFinite(localPronostico) ||
    !Number.isFinite(visitantePronostico) ||
    !Number.isFinite(localFinal) ||
    !Number.isFinite(visitanteFinal)
  ) {
    return detalleVacio;
  }

  const marcadorExacto =
    localPronostico === localFinal &&
    visitantePronostico === visitanteFinal;

  if (marcadorExacto) {
    return {
      puntos: PUNTOS_PRONOSTICO.MARCADOR_EXACTO,
      estado: "acertado",
      aciertaResultado: true,
      aciertaDiferencia: true,
      marcadorExacto: true,
    };
  }

  const diferenciaPronostico = localPronostico - visitantePronostico;
  const diferenciaFinal = localFinal - visitanteFinal;

  const resultadoPronostico = Math.sign(diferenciaPronostico);
  const resultadoReal = Math.sign(diferenciaFinal);

  if (resultadoPronostico !== resultadoReal) {
    return detalleVacio;
  }

  const aciertaDiferencia =
    Math.abs(diferenciaPronostico) === Math.abs(diferenciaFinal);

  const puntos =
    PUNTOS_PRONOSTICO.RESULTADO +
    (aciertaDiferencia ? PUNTOS_PRONOSTICO.DIFERENCIA_EXTRA : 0);

  return {
    puntos,
    estado: "acertado",
    aciertaResultado: true,
    aciertaDiferencia,
    marcadorExacto: false,
  };
}

export function calcularPuntos(pronostico, resultadoFinal) {
  return calcularDetallePuntaje(pronostico, resultadoFinal).puntos;
}

export function partidoAceptaPronosticos(partido, ahora = new Date()) {
  if (!partido || partido.estado !== "proximo") {
    return false;
  }

  if (!partido.fechaOrden) {
    return true;
  }

  return new Date(partido.fechaOrden).getTime() > ahora.getTime();
}

export function obtenerEstadisticas() {
  const pronosticos = cargarPronosticos();

  const resumen = Object.entries(pronosticos)
    .map(([partidoId, pronostico]) => {
      const partido = partidos.find(
        (partidoActual) => partidoActual.id === Number(partidoId)
      );

      if (!partido) {
        return null;
      }

      const detallePuntaje =
        partido.estado === "finalizado"
          ? calcularDetallePuntaje(pronostico, partido.resultadoFinal)
          : {
              puntos: 0,
              estado: "pendiente",
              aciertaResultado: false,
              aciertaDiferencia: false,
              marcadorExacto: false,
            };

      return {
        id: partido.id,
        torneo: partido.torneo,
        local: partido.local,
        visitante: partido.visitante,
        fechaOrden: partido.fechaOrden,
        estado: partido.estado,
        resultadoFinal: partido.resultadoFinal,
        marcador: `${pronostico.local} - ${pronostico.visitante}`,
        puntos: detallePuntaje.puntos,
        estadoPronostico: detallePuntaje.estado,
        marcadorExacto: detallePuntaje.marcadorExacto,
        aciertaDiferencia: detallePuntaje.aciertaDiferencia,
      };
    })
    .filter(Boolean);

  const pronosticosFinalizados = resumen.filter(
    (pronostico) => pronostico.estado === "finalizado"
  );

  const puntosTotales = resumen.reduce(
    (total, pronostico) => total + pronostico.puntos,
    0
  );

  const aciertos = pronosticosFinalizados.filter(
    (pronostico) => pronostico.puntos > 0
  ).length;

  const porcentajeAciertos =
    pronosticosFinalizados.length > 0
      ? Math.round((aciertos / pronosticosFinalizados.length) * 100)
      : 0;

  const pronosticosOrdenados = [...pronosticosFinalizados].sort(
    (a, b) => new Date(b.fechaOrden) - new Date(a.fechaOrden)
  );

  let rachaActual = 0;

  for (const pronostico of pronosticosOrdenados) {
    if (pronostico.puntos > 0) {
      rachaActual += 1;
    } else {
      break;
    }
  }

  return {
    resumen,
    totalPronosticos: resumen.length,
    puntosTotales,
    aciertos,
    porcentajeAciertos,
    rachaActual,
  };
}

import partidos from "../data/partidos";

export function cargarPronosticos() {
  try {
    const datosGuardados = localStorage.getItem("predigol-pronosticos");

    return datosGuardados ? JSON.parse(datosGuardados) : {};
  } catch {
    return {};
  }
}

export function calcularPuntos(pronostico, resultadoFinal) {
  if (!pronostico || !resultadoFinal) {
    return 0;
  }

  const localPronostico = Number(pronostico.local);
  const visitantePronostico = Number(pronostico.visitante);

  const localFinal = Number(resultadoFinal.local);
  const visitanteFinal = Number(resultadoFinal.visitante);

  const marcadorExacto =
    localPronostico === localFinal &&
    visitantePronostico === visitanteFinal;

  if (marcadorExacto) {
    return 5;
  }

  const diferenciaPronostico = localPronostico - visitantePronostico;
  const diferenciaFinal = localFinal - visitanteFinal;

  const resultadoPronostico = Math.sign(diferenciaPronostico);
  const resultadoReal = Math.sign(diferenciaFinal);

  if (resultadoPronostico !== resultadoReal) {
    return 0;
  }

  const aciertaDiferencia =
    resultadoReal !== 0 &&
    Math.abs(diferenciaPronostico) === Math.abs(diferenciaFinal);

  if (aciertaDiferencia) {
    return 4;
  }

  return 3;
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

      const puntos =
        partido.estado === "finalizado"
          ? calcularPuntos(pronostico, partido.resultadoFinal)
          : 0;

      return {
        id: partido.id,
        torneo: partido.torneo,
        local: partido.local,
        visitante: partido.visitante,
        fechaOrden: partido.fechaOrden,
        estado: partido.estado,
        resultadoFinal: partido.resultadoFinal,
        marcador: `${pronostico.local} - ${pronostico.visitante}`,
        puntos,
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
    rachaActual,
  };
}
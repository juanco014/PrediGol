import { calcularDetallePuntaje } from "../utils/estadisticas.js";

export const estadisticasVacias = {
  resumen: [],
  totalPronosticos: 0,
  puntosTotales: 0,
  aciertos: 0,
  porcentajeAciertos: 0,
  rachaActual: 0,
};

export function crearEstadisticasVacias() {
  return { ...estadisticasVacias, resumen: [] };
}

export function mapPronosticoConPartido(pronostico, partido) {
  if (!pronostico || !partido) {
    return null;
  }

  const resultadoFinal =
    partido.estado === "finalizado"
      ? {
          local: partido.goles_local_final,
          visitante: partido.goles_visitante_final,
        }
      : null;
  const marcador = {
    local: pronostico.goles_local,
    visitante: pronostico.goles_visitante,
  };
  const detallePuntaje = resultadoFinal
    ? calcularDetallePuntaje(marcador, resultadoFinal)
    : {
        puntos: 0,
        estado: "pendiente",
        aciertaResultado: false,
        aciertaDiferencia: false,
        marcadorExacto: false,
      };

  return {
    pronosticoId: pronostico.id ?? null,
    usuarioId: pronostico.usuario_id ?? null,
    id: partido.id,
    partidoId: partido.id,
    fixtureId: partido.api_football_fixture_id ?? null,
    torneo: partido.torneo,
    leagueName: partido.torneo,
    local: partido.local_nombre,
    visitante: partido.visitante_nombre,
    homeTeamName: partido.local_nombre,
    awayTeamName: partido.visitante_nombre,
    localLogoUrl: partido.localLogoUrl || partido.local_logo_url || null,
    visitanteLogoUrl: partido.visitanteLogoUrl || partido.visitante_logo_url || null,
    homeLogoUrl: partido.localLogoUrl || partido.local_logo_url || null,
    awayLogoUrl: partido.visitanteLogoUrl || partido.visitante_logo_url || null,
    fechaOrden: partido.fecha_orden,
    kickoffAt: partido.fecha_orden,
    estado: partido.estado,
    status: partido.estado,
    resultadoFinal,
    homeScore: resultadoFinal?.local ?? null,
    awayScore: resultadoFinal?.visitante ?? null,
    marcador: `${marcador.local} - ${marcador.visitante}`,
    prediccionUsuario: marcador,
    puntos: detallePuntaje.puntos,
    acierto: detallePuntaje.puntos > 0,
    estadoPronostico: detallePuntaje.estado,
    marcadorExacto: detallePuntaje.marcadorExacto,
    aciertaDiferencia: detallePuntaje.aciertaDiferencia,
  };
}

export function buildEstadisticasUsuario(pronosticos = [], partidos = []) {
  const partidosPorId = new Map((partidos || []).map((partido) => [partido.id, partido]));
  const resumen = (pronosticos || [])
    .map((pronostico) => mapPronosticoConPartido(pronostico, partidosPorId.get(pronostico.partido_id)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());
  const pronosticosFinalizados = resumen.filter((pronostico) => pronostico.estado === "finalizado");
  const puntosTotales = resumen.reduce((total, pronostico) => total + pronostico.puntos, 0);
  const aciertos = pronosticosFinalizados.filter((pronostico) => pronostico.puntos > 0).length;
  const porcentajeAciertos = pronosticosFinalizados.length > 0
    ? Math.round((aciertos / pronosticosFinalizados.length) * 100)
    : 0;
  let rachaActual = 0;

  for (const pronostico of pronosticosFinalizados) {
    if (pronostico.puntos > 0) rachaActual += 1;
    else break;
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

export function uniqueFinishedTournaments(rows = []) {
  return [...new Set((rows || []).map((row) => row.torneo || row.name).filter(Boolean))].sort();
}

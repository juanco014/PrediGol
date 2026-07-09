import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas.js";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos.js";

export const MAX_AVISOS = 20;
export const HORA_MS = 60 * 60 * 1000;

export function adaptarPartidoNotificacion(partido) {
  return {
    id: partido.id,
    source: partido.origen_datos || partido.source || "partidos",
    partidoId: partido.id,
    fixtureId: partido.api_football_fixture_id ?? null,
    torneo: partido.torneo,
    leagueName: partido.torneo,
    fechaOrden: partido.fecha_orden,
    kickoffAt: partido.fecha_orden,
    local: partido.local_nombre,
    visitante: partido.visitante_nombre,
    homeTeamName: partido.local_nombre,
    awayTeamName: partido.visitante_nombre,
    homeLogoUrl: partido.localLogoUrl || partido.local_logo_url || null,
    awayLogoUrl: partido.visitanteLogoUrl || partido.visitante_logo_url || null,
    estado: partido.estado,
    status: partido.estado,
    resultadoFinal:
      partido.estado === "finalizado" &&
      partido.goles_local_final !== null &&
      partido.goles_visitante_final !== null
        ? {
            local: partido.goles_local_final,
            visitante: partido.goles_visitante_final,
          }
        : null,
    metadata: { legacyPartido: partido },
  };
}

export function mapPronosticosByPartido(pronosticos = []) {
  return Object.fromEntries(
    (pronosticos || []).map((pronostico) => [
      pronostico.partido_id,
      { local: pronostico.goles_local, visitante: pronostico.goles_visitante },
    ])
  );
}

function crearAviso({ id, partido, tipo, prioridad, titulo, detalle, etiqueta, favorito, fecha }) {
  return {
    id,
    usuarioId: null,
    tipo,
    titulo,
    mensaje: detalle,
    detalle,
    leida: false,
    createdAt: fecha,
    fecha,
    prioridad,
    etiqueta,
    favorito,
    partidoId: partido.partidoId,
    fixtureId: partido.fixtureId,
    homeTeamName: partido.homeTeamName,
    awayTeamName: partido.awayTeamName,
    homeLogoUrl: partido.homeLogoUrl,
    awayLogoUrl: partido.awayLogoUrl,
    kickoffAt: partido.kickoffAt,
    status: partido.status,
    metadata: { torneo: partido.torneo, source: partido.source },
  };
}

export function construirAvisosPartidos(partidos, pronosticos, ahora, preferences, favorites) {
  const preferencias = preferences || {};
  const favoritos = {
    isTeamFavorite: favorites?.isTeamFavorite || (() => false),
    isCompetitionFavorite: favorites?.isCompetitionFavorite || (() => false),
  };

  return (partidos || [])
    .map((partido) => {
      const pronostico = (pronosticos || {})[partido.partidoId];
      const cuentaRegresiva = obtenerCuentaRegresiva(partido.fechaOrden, ahora);
      const equipos = `${partido.local} vs ${partido.visitante}`;
      const esFavorito =
        favoritos.isTeamFavorite(partido.local) ||
        favoritos.isTeamFavorite(partido.visitante) ||
        favoritos.isCompetitionFavorite(partido.torneo);
      const avisoFavorito = preferencias.favorite_updates && esFavorito;

      if (partido.estado === "en_vivo" && (preferencias.kickoff_updates || avisoFavorito)) {
        return crearAviso({
          id: `live-${partido.partidoId}`,
          partido,
          tipo: "live",
          prioridad: 0,
          fecha: partido.fechaOrden,
          titulo: avisoFavorito ? "Tu favorito esta en vivo" : "Partido en vivo",
          detalle: `${equipos} ya esta en juego.`,
          etiqueta: "Ver partido",
          favorito: esFavorito,
        });
      }

      if (partidoAceptaPronosticos(partido, ahora) && cuentaRegresiva) {
        if (!pronostico && cuentaRegresiva.restante <= HORA_MS && preferencias.reminder_1h) {
          return crearAviso({
            id: `pending-1h-${partido.partidoId}`,
            partido,
            tipo: "pending-urgent",
            prioridad: 0,
            fecha: partido.fechaOrden,
            titulo: "Ultima hora para pronosticar",
            detalle: `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: "Pronosticar",
            favorito: esFavorito,
          });
        }

        if (!pronostico && cuentaRegresiva.restante <= 24 * HORA_MS && preferencias.reminder_24h) {
          return crearAviso({
            id: `pending-24h-${partido.partidoId}`,
            partido,
            tipo: "pending",
            prioridad: 1,
            fecha: partido.fechaOrden,
            titulo: "Te falta pronosticar",
            detalle: `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: "Pronosticar",
            favorito: esFavorito,
          });
        }

        if (avisoFavorito && cuentaRegresiva.dentroDe72Horas) {
          return crearAviso({
            id: `favorite-${partido.partidoId}`,
            partido,
            tipo: "favorite",
            prioridad: 2,
            fecha: partido.fechaOrden,
            titulo: pronostico ? "Tu favorito se acerca" : "Partido de tu favorito",
            detalle: pronostico
              ? `${equipos}: guardaste ${pronostico.local} - ${pronostico.visitante}. ${cuentaRegresiva.texto}.`
              : `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: pronostico ? "Revisar" : "Pronosticar",
            favorito: true,
          });
        }
      }

      if (partido.estado === "finalizado" && partido.resultadoFinal) {
        if (pronostico && preferencias.result_updates) {
          const detallePuntaje = calcularDetallePuntaje(pronostico, partido.resultadoFinal);
          return crearAviso({
            id: `result-${partido.partidoId}`,
            partido,
            tipo: detallePuntaje.puntos > 0 ? "result-win" : "result",
            prioridad: 3,
            fecha: partido.fechaOrden,
            titulo: detallePuntaje.puntos > 0
              ? `Sumaste ${detallePuntaje.puntos} puntos`
              : "Resultado disponible",
            detalle: `${equipos} termino ${partido.resultadoFinal.local} - ${partido.resultadoFinal.visitante}.`,
            etiqueta: "Ver resultado",
            favorito: esFavorito,
          });
        }

        if (avisoFavorito) {
          return crearAviso({
            id: `favorite-result-${partido.partidoId}`,
            partido,
            tipo: "favorite",
            prioridad: 4,
            fecha: partido.fechaOrden,
            titulo: "Resultado de tu favorito",
            detalle: `${equipos} termino ${partido.resultadoFinal.local} - ${partido.resultadoFinal.visitante}.`,
            etiqueta: "Ver resultado",
            favorito: true,
          });
        }
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    })
    .slice(0, MAX_AVISOS);
}

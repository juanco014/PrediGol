import { supabase } from "../lib/supabase";
import { calcularDetallePuntaje } from "./estadisticas";

export const estadisticasVacias = {
  resumen: [],
  totalPronosticos: 0,
  puntosTotales: 0,
  aciertos: 0,
  porcentajeAciertos: 0,
  rachaActual: 0,
};

export function crearEstadisticasVacias() {
  return {
    resumen: [],
    totalPronosticos: 0,
    puntosTotales: 0,
    aciertos: 0,
    porcentajeAciertos: 0,
    rachaActual: 0,
  };
}

export async function obtenerEstadisticasSupabase(usuarioId) {
  if (!usuarioId) {
    return crearEstadisticasVacias();
  }

  const [respuestaPartidos, respuestaPronosticos] = await Promise.all([
    supabase
      .from("partidos")
      .select(
        `
          id,
          torneo,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          estado,
          goles_local_final,
          goles_visitante_final
        `
      ),

    supabase
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante")
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaPartidos.error) {
    throw respuestaPartidos.error;
  }

  if (respuestaPronosticos.error) {
    throw respuestaPronosticos.error;
  }

  const partidosPorId = new Map(
    (respuestaPartidos.data || []).map((partido) => [partido.id, partido])
  );

  const resumen = (respuestaPronosticos.data || [])
    .map((pronostico) => {
      const partido = partidosPorId.get(pronostico.partido_id);

      if (!partido) {
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

      const detallePuntaje =
        partido.estado === "finalizado"
          ? calcularDetallePuntaje(marcador, resultadoFinal)
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
        local: partido.local_nombre,
        visitante: partido.visitante_nombre,
        fechaOrden: partido.fecha_orden,
        estado: partido.estado,
        resultadoFinal,
        marcador: `${marcador.local} - ${marcador.visitante}`,
        puntos: detallePuntaje.puntos,
        estadoPronostico: detallePuntaje.estado,
        marcadorExacto: detallePuntaje.marcadorExacto,
        aciertaDiferencia: detallePuntaje.aciertaDiferencia,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime()
    );

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

  let rachaActual = 0;

  for (const pronostico of pronosticosFinalizados) {
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

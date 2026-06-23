import { useEffect, useState } from "react";
import {
  crearEstadisticasVacias,
  obtenerEstadisticasSupabase,
} from "../utils/estadisticasSupabase";

export function useEstadisticasPrediGol(usuarioId) {
  const [resultadoConsulta, setResultadoConsulta] = useState({
    usuarioId: null,
    estadisticas: crearEstadisticasVacias(),
    error: "",
  });

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerEstadisticasSupabase(usuarioId)
      .then((estadisticasCargadas) => {
        if (!respuestaCancelada) {
          setResultadoConsulta({
            usuarioId,
            estadisticas: estadisticasCargadas,
            error: "",
          });
        }
      })
      .catch((errorConsulta) => {
        console.error("Error al cargar estadísticas:", errorConsulta);

        if (!respuestaCancelada) {
          setResultadoConsulta({
            usuarioId,
            estadisticas: crearEstadisticasVacias(),
            error:
              "No fue posible cargar tus estadísticas. Intenta recargar la página.",
          });
        }
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId]);

  const consultaCorrespondeAlUsuario = resultadoConsulta.usuarioId === usuarioId;

  return {
    estadisticasPrediGol:
      usuarioId && consultaCorrespondeAlUsuario
        ? resultadoConsulta.estadisticas
        : crearEstadisticasVacias(),
    cargando: Boolean(usuarioId && !consultaCorrespondeAlUsuario),
    error: consultaCorrespondeAlUsuario ? resultadoConsulta.error : "",
  };
}

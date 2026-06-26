import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";

const MAX_PARTIDOS_INICIO = 10;

function formatearPorcentaje(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "0%";
  }

  return `${Math.round(numero * 100)}%`;
}

async function consultarDatosInicio(usuarioId) {
  const [respuestaPartidos, respuestaPronosticos] = await Promise.all([
    supabase
      .from("partidos")
      .select(
        `
          id,
          torneo,
          fecha_texto,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          local_corto,
          visitante_corto,
          estado,
          goles_local_final,
          goles_visitante_final,
          api_football_fixture_id,
          minuto,
          es_relevante,
          prioridad_visual
        `
      )
      .eq("es_relevante", true)
      .order("prioridad_visual", { ascending: true })
      .order("fecha_orden", { ascending: true })
      .limit(MAX_PARTIDOS_INICIO),

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

  const partidosAdaptados = (respuestaPartidos.data || []).map((partido) => ({
    id: partido.id,
    apiFootballFixtureId: partido.api_football_fixture_id,
    torneo: partido.torneo,
    fecha: partido.fecha_texto,
    fechaOrden: partido.fecha_orden,
    local: partido.local_nombre,
    visitante: partido.visitante_nombre,
    localShort: partido.local_corto,
    visitanteShort: partido.visitante_corto,
    estado: partido.estado,
    esRelevante: partido.es_relevante,
    prioridadVisual: partido.prioridad_visual,
    resultadoFinal:
      partido.estado === "finalizado"
        ? {
            local: partido.goles_local_final,
            visitante: partido.goles_visitante_final,
          }
        : null,
    minuto: partido.minuto,
  }));

  const pronosticosPorPartido = Object.fromEntries(
    (respuestaPronosticos.data || []).map((pronostico) => [
      pronostico.partido_id,
      {
        local: pronostico.goles_local,
        visitante: pronostico.goles_visitante,
      },
    ])
  );

  const apiFootballFixtureIds = partidosAdaptados
    .map((partido) => partido.apiFootballFixtureId)
    .filter(Boolean);

  let prediccionesModelo = {};

  if (apiFootballFixtureIds.length > 0) {
    const respuestaPredicciones = await supabase
      .from("model_predictions")
      .select(
        `
          api_football_fixture_id,
          home_win_probability,
          draw_probability,
          away_win_probability,
          expected_home_goals,
          expected_away_goals,
          predicted_home_goals,
          predicted_away_goals,
          confidence,
          model_version,
          generated_at
        `
      )
      .in("api_football_fixture_id", apiFootballFixtureIds);

    if (respuestaPredicciones.error) {
      console.warn(
        "No fue posible cargar predicciones del modelo:",
        respuestaPredicciones.error
      );
    } else {
      prediccionesModelo = Object.fromEntries(
        (respuestaPredicciones.data || []).map((prediccion) => [
          prediccion.api_football_fixture_id,
          prediccion,
        ])
      );
    }
  }

  return {
    partidos: partidosAdaptados,
    pronosticos: pronosticosPorPartido,
    prediccionesModelo,
  };
}

function HomePage({ session }) {
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [prediccionesModelo, setPrediccionesModelo] = useState({});
  const [pronosticosGuardados, setPronosticosGuardados] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardandoPartidoId, setGuardandoPartidoId] = useState(null);
  const [momentoActual, setMomentoActual] = useState(() => new Date());
  const [versionDatosEnVivo, setVersionDatosEnVivo] = useState(0);

  const usuarioId = session?.user?.id;
  const { profile } = useProfile(usuarioId);

  const nombreCompleto =
    profile?.nombre ||
    session?.user?.user_metadata?.nombre ||
    "Hincha";

  const primerNombre = nombreCompleto.trim().split(/\s+/)[0] || "Hincha";

  const username = profile?.username
    ? `@${profile.username}`
    : "@hincha_predigol";

  const inicialUsuario = primerNombre.charAt(0).toUpperCase();

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    consultarDatosInicio(usuarioId)
      .then((datos) => {
        if (respuestaCancelada) {
          return;
        }

        const estadoGuardados = Object.keys(datos.pronosticos).reduce(
          (estado, partidoId) => {
            estado[partidoId] = true;
            return estado;
          },
          {}
        );

        setPartidos(datos.partidos);
        setPronosticos(datos.pronosticos);
        setPrediccionesModelo(datos.prediccionesModelo);
        setPronosticosGuardados(estadoGuardados);
      })
      .catch((error) => {
        console.error("Error al cargar los partidos:", error);

        if (!respuestaCancelada) {
          setMensaje(
            "No fue posible cargar los partidos. Recarga la página e inténtalo nuevamente."
          );
        }
      })
      .finally(() => {
        if (!respuestaCancelada) {
          setCargando(false);
        }
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId, versionDatosEnVivo]);

  useEffect(() => {
    const canal = supabase
      .channel("predigol-partidos-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partidos" },
        () => setVersionDatosEnVivo((versionActual) => versionActual + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "model_predictions" },
        () => setVersionDatosEnVivo((versionActual) => versionActual + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setMomentoActual(new Date());
    }, 30000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, []);

  const estadisticas = useMemo(() => {
    const resumen = partidos
      .map((partido) => {
        const pronostico = pronosticos[partido.id];

        if (!pronostico) {
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
          estado: partido.estado,
          puntos: detallePuntaje.puntos,
          estadoPronostico: detallePuntaje.estado,
          marcadorExacto: detallePuntaje.marcadorExacto,
          aciertaDiferencia: detallePuntaje.aciertaDiferencia,
        };
      })
      .filter(Boolean);

    const puntosTotales = resumen.reduce(
      (total, pronostico) => total + pronostico.puntos,
      0
    );

    const aciertos = resumen.filter(
      (pronostico) =>
        pronostico.estado === "finalizado" && pronostico.puntos > 0
    ).length;

    return {
      puntosTotales,
      aciertos,
      resumen,
    };
  }, [partidos, pronosticos]);

  const resumenPorPartido = Object.fromEntries(
    estadisticas.resumen.map((pronostico) => [pronostico.id, pronostico])
  );

  const usuarioActual = crearUsuarioRanking({
    puntosTotales: estadisticas.puntosTotales,
    aciertos: estadisticas.aciertos,
    nombre: nombreCompleto,
    usuario: username,
    avatar: inicialUsuario,
  });

  const { posicionUsuario } = obtenerRankingGlobal(usuarioActual);

  const cambiarMarcador = (partidoId, equipo, valor) => {
    setPronosticos((actual) => ({
      ...actual,
      [partidoId]: {
        ...actual[partidoId],
        [equipo]: valor,
      },
    }));

    setPronosticosGuardados((actual) => ({
      ...actual,
      [partidoId]: false,
    }));
  };

  const guardarPronostico = async (partidoId) => {
    const partido = partidos.find(
      (partidoActual) => partidoActual.id === partidoId
    );

    if (!partido || !partidoAceptaPronosticos(partido, momentoActual)) {
      setMensaje(
        "Este partido ya inició o finalizó y no admite pronósticos."
      );
      return;
    }

    const pronostico = pronosticos[partidoId];

    const golesLocal = Number(pronostico?.local);
    const golesVisitante = Number(pronostico?.visitante);

    const marcadorInvalido =
      pronostico?.local === "" ||
      pronostico?.visitante === "" ||
      pronostico?.local === undefined ||
      pronostico?.visitante === undefined ||
      !Number.isInteger(golesLocal) ||
      !Number.isInteger(golesVisitante) ||
      golesLocal < 0 ||
      golesVisitante < 0 ||
      golesLocal > 99 ||
      golesVisitante > 99;

    if (marcadorInvalido) {
      setMensaje("Ingresa un marcador válido para ambos equipos.");
      return;
    }

    if (!usuarioId) {
      setMensaje("No encontramos tu sesión. Inicia sesión nuevamente.");
      return;
    }

    setGuardandoPartidoId(partidoId);
    setMensaje("");

    try {
      const { error } = await supabase.from("pronosticos").upsert(
        {
          partido_id: partidoId,
          usuario_id: usuarioId,
          goles_local: golesLocal,
          goles_visitante: golesVisitante,
          actualizado_en: new Date().toISOString(),
        },
        {
          onConflict: "partido_id,usuario_id",
        }
      );

      if (error) {
        throw error;
      }

      setPronosticos((actual) => ({
        ...actual,
        [partidoId]: {
          local: golesLocal,
          visitante: golesVisitante,
        },
      }));

      setPronosticosGuardados((actual) => ({
        ...actual,
        [partidoId]: true,
      }));

      setMensaje("¡Tu pronóstico fue guardado correctamente!");
    } catch (error) {
      console.error("Error al guardar el pronóstico:", error);

      setMensaje(
        error.message ||
          "No fue posible guardar el pronóstico. Inténtalo nuevamente."
      );
    } finally {
      setGuardandoPartidoId(null);
    }
  };

  return (
    <main className="home-page">
      <header className="home-header">
        <div>
          <p className="brand">PREDIGOL</p>
          <h2>Hola, {primerNombre} 👋</h2>
          <p>Demuestra que sabes más que tus amigos.</p>
        </div>

        <div className="profile-avatar">{inicialUsuario}</div>
      </header>

      {mensaje && <p className="prediction-message">{mensaje}</p>}

      <section className="points-card">
        <div>
          <p>Tus puntos</p>
          <strong>{estadisticas.puntosTotales}</strong>
        </div>

        <div className="points-line" />

        <div>
          <p>Posición</p>
          <strong>#{posicionUsuario}</strong>
        </div>
      </section>

      <section className="section-header">
        <div>
          <p className="section-label">PARTIDOS DESTACADOS</p>
          <h3>Haz tus pronósticos</h3>
        </div>

        <span className="matches-count">
          {partidos.length} {partidos.length === 1 ? "partido" : "partidos"}
        </span>
      </section>

      {cargando ? (
        <p className="prediction-message">Cargando partidos...</p>
      ) : partidos.length === 0 ? (
        <section className="empty-league-card">
          <p>No hay partidos disponibles.</p>
          <span>
            Cuando el admin marque partidos relevantes de la temporada,
            aparecerán aquí para pronosticar.
          </span>
        </section>
      ) : (
        <section className="matches-list">
          {partidos.map((partido) => {
            const partidoFinalizado = partido.estado === "finalizado";
            const partidoEnVivo = partido.estado === "en_vivo";
            const partidoCancelado = partido.estado === "cancelado";
            const partidoBloqueado =
              partidoFinalizado ||
              partidoEnVivo ||
              partidoCancelado ||
              !partidoAceptaPronosticos(partido, momentoActual);

            const detallePronostico = resumenPorPartido[partido.id];
            const prediccionModelo =
              prediccionesModelo[partido.apiFootballFixtureId];

            const etiquetaEstado = partidoCancelado
              ? "Cancelado"
              : partidoEnVivo
                ? partido.minuto
                  ? `En vivo - ${partido.minuto}'`
                  : "En vivo"
                : partidoBloqueado
                  ? partidoFinalizado
                    ? "Finalizado"
                    : "Cerrado"
                  : partido.fecha;

            return (
              <article className="match-card" key={partido.id}>
                <div className="match-top">
                  <span>{partido.torneo}</span>

                  <span
                    className={
                      partidoFinalizado
                        ? "match-status final-status"
                        : "match-status"
                    }
                  >
                    {etiquetaEstado}
                  </span>
                </div>

                <div className="teams-row">
                  <div className="team">
                    <div className="team-badge">{partido.localShort}</div>
                    <p>{partido.local}</p>
                  </div>

                  <div className="versus">VS</div>

                  <div className="team">
                    <div className="team-badge">{partido.visitanteShort}</div>
                    <p>{partido.visitante}</p>
                  </div>
                </div>

                {partidoFinalizado && (
                  <div className="final-result">
                    Resultado final:
                    <strong>
                      {partido.resultadoFinal.local} -{" "}
                      {partido.resultadoFinal.visitante}
                    </strong>
                  </div>
                )}

                {prediccionModelo && (
                  <div className="model-prediction-card">
                    <div>
                      <span>Modelo PrediGol</span>
                      <strong>
                        {prediccionModelo.predicted_home_goals} -{" "}
                        {prediccionModelo.predicted_away_goals}
                      </strong>
                    </div>

                    <div className="model-probabilities">
                      <span>
                        Local{" "}
                        {formatearPorcentaje(
                          prediccionModelo.home_win_probability
                        )}
                      </span>
                      <span>
                        Empate{" "}
                        {formatearPorcentaje(prediccionModelo.draw_probability)}
                      </span>
                      <span>
                        Visitante{" "}
                        {formatearPorcentaje(
                          prediccionModelo.away_win_probability
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <div className="match-card-actions">
                  <button
                    type="button"
                    onClick={() => navigate(`/partidos/${partido.id}`)}
                  >
                    Ver detalle
                  </button>
                </div>

                <div className="prediction-row">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    disabled={partidoBloqueado}
                    value={pronosticos[partido.id]?.local ?? ""}
                    onChange={(event) =>
                      cambiarMarcador(partido.id, "local", event.target.value)
                    }
                  />

                  <span>-</span>

                  <input
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    disabled={partidoBloqueado}
                    value={pronosticos[partido.id]?.visitante ?? ""}
                    onChange={(event) =>
                      cambiarMarcador(
                        partido.id,
                        "visitante",
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      partidoBloqueado || guardandoPartidoId === partido.id
                    }
                    className={
                      partidoBloqueado ? "prediction-finished-button" : ""
                    }
                    onClick={() => guardarPronostico(partido.id)}
                  >
                    {partidoFinalizado
                      ? detallePronostico
                        ? detallePronostico.estadoPronostico === "acertado"
                          ? `+${detallePronostico.puntos} puntos`
                          : "Pronóstico fallado"
                        : "Pronóstico cerrado"
                      : partidoCancelado
                        ? "Partido cancelado"
                      : partidoEnVivo
                        ? "Partido en vivo"
                        : partidoBloqueado
                          ? "Pronóstico cerrado"
                        : guardandoPartidoId === partido.id
                          ? "Guardando..."
                          : pronosticosGuardados[partido.id]
                            ? "Pronóstico guardado ✓"
                            : "Guardar pronóstico"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <BottomNavigation activePage="partidos" />
    </main>
  );
}

export default HomePage;

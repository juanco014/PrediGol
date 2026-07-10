import { useEffect, useMemo, useState } from "react";
import { Bell, Clock3, Heart, Medal, Target, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import TeamLogo from "../components/TeamLogo";
import { useFavorites } from "../hooks/useFavorites";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";
import { obtenerPartidosInicio } from "../services/footballApi";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos";

const MAX_PARTIDOS_INICIO = 10;

function formatearPorcentaje(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "0%";
  }

  return `${Math.round(numero * 100)}%`;
}

function esMismoDia(fecha, referencia) {
  const fechaPartido = new Date(fecha);

  if (Number.isNaN(fechaPartido.getTime())) {
    return false;
  }

  return fechaPartido.toDateString() === referencia.toDateString();
}

async function consultarDatosInicio(usuarioId) {
  return obtenerPartidosInicio(usuarioId);
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
  const [filtroPartidos, setFiltroPartidos] = useState("todos");

  const usuarioId = session?.user?.id;
  const { profile } = useProfile(usuarioId);
  const favorites = useFavorites(usuarioId);
  const { isCompetitionFavorite, isTeamFavorite } = favorites;

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

  const partidosPersonalizados = useMemo(() => {
    const esFavorito = (partido) =>
      isTeamFavorite(partido.local) ||
      isTeamFavorite(partido.visitante) ||
      isCompetitionFavorite(partido.torneo);
    const ordenados = [...partidos].sort(
      (a, b) => Number(esFavorito(b)) - Number(esFavorito(a))
    );
    const filtrados = ordenados.filter((partido) => {
      if (filtroPartidos === "favoritos") {
        return esFavorito(partido);
      }

      if (filtroPartidos === "hoy") {
        return esMismoDia(partido.fechaOrden, momentoActual);
      }

      if (filtroPartidos === "sin_pronostico") {
        return !pronosticosGuardados[partido.id];
      }

      return true;
    });

    return filtrados.slice(0, MAX_PARTIDOS_INICIO);
  }, [
    isCompetitionFavorite,
    isTeamFavorite,
    filtroPartidos,
    momentoActual,
    partidos,
    pronosticosGuardados,
  ]);

  const partidoDestacado =
    partidosPersonalizados.find((partido) =>
      partidoAceptaPronosticos(partido, momentoActual)
    ) || partidosPersonalizados[0];
  const prediccionDestacada = partidoDestacado
    ? prediccionesModelo[partidoDestacado.apiFootballFixtureId]
    : null;
  const cuentaDestacada = partidoDestacado
    ? obtenerCuentaRegresiva(partidoDestacado.fechaOrden, momentoActual)
    : null;

  const usuarioActual = crearUsuarioRanking({
    puntosTotales: estadisticas.puntosTotales,
    aciertos: estadisticas.aciertos,
    nombre: nombreCompleto,
    usuario: username,
    avatar: inicialUsuario,
  });

  const { posicionUsuario } = obtenerRankingGlobal(usuarioActual);

  const partidosAbiertos = partidosPersonalizados.filter((partido) =>
    partidoAceptaPronosticos(partido, momentoActual)
  ).length;

  const pronosticosListos = partidosPersonalizados.filter(
    (partido) => pronosticosGuardados[partido.id]
  ).length;

  const partidosConModelo = partidosPersonalizados.filter(
    (partido) => prediccionesModelo[partido.apiFootballFixtureId]
  ).length;

  const avisosPendientes = partidos.filter((partido) => {
    const cuentaRegresiva = obtenerCuentaRegresiva(
      partido.fechaOrden,
      momentoActual
    );

    return (
      partidoAceptaPronosticos(partido, momentoActual) &&
      cuentaRegresiva?.dentroDe72Horas &&
      !pronosticosGuardados[partido.id]
    );
  }).length;

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

        <div className="home-header-actions">
          <button
            type="button"
            className="notification-button"
            aria-label={
              avisosPendientes > 0
                ? `${avisosPendientes} avisos de partidos pendientes`
                : "Abrir notificaciones"
            }
            onClick={() => navigate("/notificaciones")}
          >
            <Bell size={21} />
            {avisosPendientes > 0 && <b>{avisosPendientes}</b>}
          </button>
          <button
            type="button"
            className="profile-avatar"
            aria-label="Abrir mi perfil"
            onClick={() => navigate("/perfil")}
          >
            {inicialUsuario}
          </button>
        </div>
      </header>

      <StatusMessage
        message={mensaje}
        variant={
          mensaje.toLowerCase().includes("guardado correctamente")
            ? "success"
            : "error"
        }
        onClose={() => setMensaje("")}
      />

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

        <div className="points-line" />

        <div>
          <p>Guardados</p>
          <strong>{pronosticosListos}</strong>
        </div>

        <div className="points-line" />

        <div>
          <p>Abiertos</p>
          <strong>{partidosAbiertos}</strong>
        </div>
      </section>

      <section className="home-quick-actions">
        <button type="button" onClick={() => navigate("/pronosticos")}>
          <Target size={17} />
          <span>Mis pronósticos</span>
        </button>
        <button type="button" onClick={() => navigate("/ranking")}>
          <Medal size={17} />
          <span>Ver ranking</span>
        </button>
        <button type="button" onClick={() => navigate("/ligas")}>
          <Users size={17} />
          <span>Ligas privadas</span>
        </button>
      </section>

      <section className="home-featured-match" aria-label="Partido destacado">
        <div className="home-featured-kicker">
          <div>
            <p className="section-label">PARTIDO DESTACADO</p>
            <h3>Tu foco de la jornada</h3>
          </div>
          {partidoDestacado && <span>{partidoDestacado.torneo}</span>}
        </div>

        {partidoDestacado ? (
          <>
            <div className="home-featured-scoreboard">
              <div>
                <TeamLogo
                  teamName={partidoDestacado.local}
                  logoUrl={partidoDestacado.localLogoUrl}
                  size="large"
                />
                <strong>{partidoDestacado.local}</strong>
              </div>
              <span>VS</span>
              <div>
                <TeamLogo
                  teamName={partidoDestacado.visitante}
                  logoUrl={partidoDestacado.visitanteLogoUrl}
                  size="large"
                />
                <strong>{partidoDestacado.visitante}</strong>
              </div>
            </div>

            <div className="home-featured-meta">
              <span>{partidoDestacado.fecha}</span>
              {cuentaDestacada && <span>{cuentaDestacada.texto}</span>}
              <span>
                {pronosticosGuardados[partidoDestacado.id]
                  ? "Pronóstico guardado"
                  : "Pendiente por pronosticar"}
              </span>
            </div>

            <div className="home-featured-model">
              {prediccionDestacada ? (
                prediccionDestacada.is_locked ? (
                  <>
                    <span>Predicción premium bloqueada</span>
                    <strong>{prediccionDestacada.preview_message || "Requiere plan premium."}</strong>
                  </>
                ) : (
                  <>
                    <span>
                      Modelo PrediGol {prediccionDestacada.model_version || ""}: Local {formatearPorcentaje(prediccionDestacada.home_win_probability)} · Empate {formatearPorcentaje(prediccionDestacada.draw_probability)} · Visitante {formatearPorcentaje(prediccionDestacada.away_win_probability)}
                    </span>
                    <strong>
                      PrediGol estima {prediccionDestacada.predicted_home_goals} - {prediccionDestacada.predicted_away_goals}
                    </strong>
                  </>
                )
              ) : (
                <span>Predicción del modelo no disponible todavía.</span>
              )}
            </div>

            <button
              type="button"
              className="home-featured-action"
              onClick={() => navigate(`/partidos/${partidoDestacado.id}`)}
            >
              Ver análisis del partido
            </button>
          </>
        ) : (
          <div className="home-featured-empty">
            <p>No hay partido destacado disponible.</p>
            <span>Cuando existan partidos relevantes, aparecerán aquí para priorizar tu jornada.</span>
          </div>
        )}
      </section>

      <section className="section-header">
        <div>
          <p className="section-label">PARTIDOS DESTACADOS</p>
          <h3>Haz tus pronósticos</h3>
        </div>

        <div className="home-section-counters">
          <span className="matches-count">
            {partidosPersonalizados.length}{" "}
            {partidosPersonalizados.length === 1 ? "partido" : "partidos"}
          </span>
          <span>{partidosConModelo} con modelo</span>
        </div>
      </section>

      <section className="home-match-filters" aria-label="Filtrar partidos">
        <button
          type="button"
          className={filtroPartidos === "todos" ? "home-filter-active" : ""}
          onClick={() => setFiltroPartidos("todos")}
        >
          Todos
        </button>
        <button
          type="button"
          className={
            filtroPartidos === "favoritos" ? "home-filter-active" : ""
          }
          onClick={() => setFiltroPartidos("favoritos")}
        >
          <Heart size={15} />
          Mis favoritos
        </button>
        <button
          type="button"
          className={filtroPartidos === "hoy" ? "home-filter-active" : ""}
          onClick={() => setFiltroPartidos("hoy")}
        >
          Hoy
        </button>
        <button
          type="button"
          className={
            filtroPartidos === "sin_pronostico" ? "home-filter-active" : ""
          }
          onClick={() => setFiltroPartidos("sin_pronostico")}
        >
          Sin pronóstico
        </button>
      </section>

      {cargando ? (
        <LoadingState cards={3} label="Cargando partidos destacados" />
      ) : partidosPersonalizados.length === 0 ? (
        <section className="empty-league-card">
          <p>
            {filtroPartidos === "favoritos"
              ? "Aún no hay partidos de tus favoritos."
                    : "No hay partidos disponibles todavía."}
          </p>
          <span>
            {filtroPartidos === "favoritos"
              ? "Abre el detalle de un partido y sigue un equipo o torneo."
              : "Los partidos relevantes de la temporada aparecerán aquí para pronosticar."}
          </span>
        </section>
      ) : (
        <section className="matches-list">
          {partidosPersonalizados.map((partido) => {
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

            const pronosticoGuardado = pronosticosGuardados[partido.id];
            const partidoFavorito =
              isTeamFavorite(partido.local) ||
              isTeamFavorite(partido.visitante) ||
              isCompetitionFavorite(partido.torneo);
            const cuentaRegresiva = partidoBloqueado
              ? null
              : obtenerCuentaRegresiva(partido.fechaOrden, momentoActual);
            const claseTarjeta = [
              "match-card",
              partidoBloqueado ? "match-card-locked" : "match-card-open",
              pronosticoGuardado ? "match-card-saved" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <article className={claseTarjeta} key={partido.id}>
                <div className="match-top">
                  <span>
                    {partidoFavorito && (
                      <Heart
                        className="match-favorite-mark"
                        size={13}
                        fill="currentColor"
                      />
                    )}
                    {partido.torneo}
                  </span>

                  <div className="match-status-group">
                    {pronosticoGuardado && <em>Guardado</em>}
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
                </div>

                {cuentaRegresiva && (
                  <div
                    className={`match-countdown ${
                      cuentaRegresiva.urgente ? "match-countdown-urgent" : ""
                    }`}
                  >
                    <Clock3 size={15} />
                    <strong>{cuentaRegresiva.texto}</strong>
                    <span>para cerrar pronósticos</span>
                  </div>
                )}

                <div className="teams-row">
                  <div className="team">
                    <TeamLogo
                      teamName={partido.local}
                      logoUrl={partido.localLogoUrl}
                      size="medium"
                      className="team-badge"
                    />
                    <p>{partido.local}</p>
                  </div>

                  <div className="versus">VS</div>

                  <div className="team">
                    <TeamLogo
                      teamName={partido.visitante}
                      logoUrl={partido.visitanteLogoUrl}
                      size="medium"
                      className="team-badge"
                    />
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
                      <span>{prediccionModelo.is_locked ? "Premium" : `Modelo PrediGol ${prediccionModelo.model_version || ""}`}</span>
                      <strong>
                        {prediccionModelo.is_locked
                          ? "Bloqueado"
                          : `${prediccionModelo.predicted_home_goals} - ${prediccionModelo.predicted_away_goals}`}
                      </strong>
                    </div>

                    {prediccionModelo.is_locked ? (
                      <p>{prediccionModelo.preview_message || "Requiere plan premium."}</p>
                    ) : (
                      <div className="model-probabilities">
                        <span>Local {formatearPorcentaje(prediccionModelo.home_win_probability)}</span>
                        <span>Empate {formatearPorcentaje(prediccionModelo.draw_probability)}</span>
                        <span>Visitante {formatearPorcentaje(prediccionModelo.away_win_probability)}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="match-helper-text">
                  {partidoBloqueado
                    ? partidoFinalizado
                      ? "Partido cerrado: ya puedes revisar tus puntos."
                      : "Pronósticos cerrados para este partido."
                    : pronosticoGuardado
                      ? "Puedes cambiar tu marcador mientras el partido siga abierto."
                      : "Guarda tu marcador antes de que inicie el partido."}
                </p>

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

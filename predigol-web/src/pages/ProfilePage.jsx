import { useEffect, useState } from "react";
import {
  Award,
  BarChart3,
  Flame,
  Heart,
  LogOut,
  Percent,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import TeamLogo from "../components/TeamLogo";
import {
  estadisticasVacias,
  obtenerResumenPerfil,
} from "../services/predictionStatsApi";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { obtenerRankingGlobalSupabase } from "../utils/rankingSupabase";
import {
  cerrarSesion as cerrarSesionCuenta,
  obtenerMensajeErrorAuth,
  obtenerPlanUsuario,
  reclamarPrimerAdmin as reclamarPrimerAdminCuenta,
} from "../services/userAccountApi";
import { useFavorites } from "../hooks/useFavorites";
import { useProfile } from "../hooks/useProfile";
import { isAdminUser } from "../utils/admin";

function ProfilePage({ session }) {
  const navigate = useNavigate();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [activandoAdmin, setActivandoAdmin] = useState(false);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);
  const [estadisticasPrediGol, setEstadisticasPrediGol] =
    useState(estadisticasVacias);
  const [rankingSupabase, setRankingSupabase] = useState([]);
  const [favoritosMensaje, setFavoritosMensaje] = useState("");
  const [planUsuario, setPlanUsuario] = useState({ planCode: "free", status: "free", isPremium: false });

  const usuarioId = session?.user?.id;
  const { profile } = useProfile(usuarioId);
  const favorites = useFavorites(usuarioId);
  const esAdmin = isAdminUser(profile);

  const quitarFavorito = async (tipo, nombre) => {
    try {
      if (tipo === "equipo") {
        await favorites.toggleTeam(nombre);
      } else {
        await favorites.toggleCompetition(nombre);
      }
      setFavoritosMensaje("");
    } catch (error) {
      setFavoritosMensaje(
        error.message || "No fue posible actualizar tus favoritos."
      );
    }
  };

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerResumenPerfil(usuarioId)
      .then((estadisticas) => {
        if (!respuestaCancelada) {
          setEstadisticasPrediGol(estadisticas);
        }
      })
      .catch((error) => {
        console.error("Error al cargar estadísticas del perfil:", error);
      })
      .finally(() => {
        if (!respuestaCancelada) {
          setCargandoEstadisticas(false);
        }
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId]);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerPlanUsuario()
      .then((plan) => {
        if (!respuestaCancelada) {
          setPlanUsuario(plan);
        }
      })
      .catch((error) => {
        console.error("Error al cargar plan del usuario:", error);
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId]);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerRankingGlobalSupabase(usuarioId)
      .then((ranking) => {
        if (!respuestaCancelada) {
          setRankingSupabase(ranking);
        }
      })
      .catch((error) => {
        console.error("Error al cargar posicion global:", error);
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId]);

  const nombreCompleto =
    profile?.nombre ||
    session?.user?.user_metadata?.nombre ||
    "Hincha PrediGol";

  const username = profile?.username
    ? `@${profile.username}`
    : "@hincha_predigol";

  const inicialUsuario = nombreCompleto.trim().charAt(0).toUpperCase();

  const usuarioActual = crearUsuarioRanking({
    puntosTotales: estadisticasPrediGol.puntosTotales,
    aciertos: estadisticasPrediGol.aciertos,
    nombre: nombreCompleto,
    usuario: username,
    avatar: inicialUsuario,
  });

  const rankingLocal = obtenerRankingGlobal(usuarioActual);
  const jugadorRankingSupabase = rankingSupabase.find(
    (jugador) => jugador.esUsuarioActual
  );
  const posicionUsuario =
    jugadorRankingSupabase?.posicion || rankingLocal.posicionUsuario;

  const cerrarSesion = async () => {
    try {
      setCerrandoSesion(true);

      await cerrarSesionCuenta();
    } catch (error) {
      window.alert(
        obtenerMensajeErrorAuth(
          error,
          "No fue posible cerrar sesión. Inténtalo de nuevo."
        )
      );
    } finally {
      setCerrandoSesion(false);
    }
  };

  const reclamarPrimerAdmin = async () => {
    try {
      setActivandoAdmin(true);

      await reclamarPrimerAdminCuenta();

      window.location.reload();
    } catch (error) {
      window.alert(
        obtenerMensajeErrorAuth(
          error,
          "No fue posible activar el administrador. Revisa si ya existe otro admin."
        )
      );
    } finally {
      setActivandoAdmin(false);
    }
  };

  const estadisticas = [
    {
      label: "Pronósticos",
      value: estadisticasPrediGol.totalPronosticos,
      icon: Target,
    },
    {
      label: "Aciertos",
      value: estadisticasPrediGol.aciertos,
      icon: Trophy,
    },
    {
      label: "Efectividad",
      value: `${estadisticasPrediGol.porcentajeAciertos}%`,
      icon: Percent,
    },
    {
      label: "Racha actual",
      value: estadisticasPrediGol.rachaActual,
      icon: Flame,
    },
  ];

  const tienePrimerAcierto = estadisticasPrediGol.aciertos > 0;

  const logro = tienePrimerAcierto
    ? {
        etiqueta: "LOGRO DESBLOQUEADO",
        titulo: "Primer acierto",
        descripcion:
          "Acertaste el resultado de un partido y sumaste tus primeros puntos.",
      }
    : {
        etiqueta: "PRÓXIMO LOGRO",
        titulo: "Primer acierto",
        descripcion:
          "Acierta el resultado de un partido para desbloquearlo.",
      };

  return (
    <main className="profile-page">
      <header className="profile-header">
        <div className="profile-header-top">
          <p className="brand">PREDIGOL</p>

          <button
            className="profile-signout-button"
            type="button"
            onClick={cerrarSesion}
            disabled={cerrandoSesion}
          >
            <LogOut size={17} />
            {cerrandoSesion ? "Saliendo..." : "Salir"}
          </button>
        </div>

        <div className="profile-main">
          <div className="profile-avatar profile-avatar-large">
            {inicialUsuario}
          </div>

          <div>
            <h1>{nombreCompleto}</h1>
            <p>{username}</p>
          </div>
        </div>
      </header>

      <section className="profile-rank-card">
        <div>
          <p>Tu posición general</p>
          <strong>#{posicionUsuario}</strong>
        </div>

        <div className="profile-rank-divider" />

        <div>
          <p>Puntos totales</p>
          <strong>{estadisticasPrediGol.puntosTotales}</strong>
        </div>
      </section>

      <section className="profile-section profile-plan-card">
        <p className="section-label">PLAN ACTUAL</p>
        <h2>{planUsuario.isPremium ? "Premium" : "Gratis"}</h2>
        <p>
          {planUsuario.isPremium
            ? "Tu cuenta tiene acceso premium activo segun Supabase."
            : "Tu cuenta usa el plan gratuito. Premium real queda preparado para una fase posterior."}
        </p>
        <span>
          Estado: {planUsuario.status || "free"}
          {planUsuario.expiresAt ? ` · vence ${new Date(planUsuario.expiresAt).toLocaleDateString("es-CO")}` : ""}
        </span>
        {!planUsuario.isPremium && (
          <button type="button" disabled>
            Premium proximamente
          </button>
        )}
      </section>

      <section className="profile-section">
        <p className="section-label">TU RENDIMIENTO</p>
        <h2>Estadísticas de la temporada</h2>

        <div className="stats-grid">
          {estadisticas.map((estadistica) => {
            const Icon = estadistica.icon;

            return (
              <article className="stat-card" key={estadistica.label}>
                <Icon size={20} />
                <strong>{estadistica.value}</strong>
                <span>{estadistica.label}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="profile-section">
        <p className="section-label">MIS PRONÓSTICOS</p>
        <h2>Marcadores guardados</h2>
        <div className="profile-section-actions">
          <p>Vista rápida de tus últimos 3 pronósticos.</p>
          <button type="button" onClick={() => navigate("/pronosticos")}>
            Ver historial completo
          </button>
        </div>

        {cargandoEstadisticas ? (
          <article className="no-predictions-card">
            Cargando tus pronósticos...
          </article>
        ) : estadisticasPrediGol.resumen.length === 0 ? (
          <article className="no-predictions-card">
            Aún no has guardado pronósticos. Ve a Partidos y demuestra que
            sabes de fútbol.
          </article>
        ) : (
          <div className="saved-predictions-list">
            {estadisticasPrediGol.resumen.slice(0, 3).map((pronostico) => {
              const pronosticoFinalizado =
                pronostico.estado === "finalizado";

              const pronosticoAcertado =
                pronostico.estadoPronostico === "acertado";

              const etiquetaEstado = pronosticoFinalizado
                ? pronosticoAcertado
                  ? `Acertado · +${pronostico.puntos} pts`
                  : "Fallado · +0 pts"
                : "Pendiente";

              return (
                <article className="saved-prediction-card" key={pronostico.id}>
                  <div className="saved-prediction-main">
                    <p className="saved-prediction-tournament">
                      {pronostico.torneo}
                    </p>

                    <div className="saved-prediction-teams">
                      <TeamLogo teamName={pronostico.local} size="small" />
                      <h3>
                        {pronostico.local} vs {pronostico.visitante}
                      </h3>
                      <TeamLogo teamName={pronostico.visitante} size="small" />
                    </div>

                    <p className="saved-prediction-detail">
                      Tu pronóstico: {pronostico.marcador}
                      {pronostico.resultadoFinal &&
                        ` · Resultado final: ${pronostico.resultadoFinal.local} - ${pronostico.resultadoFinal.visitante}`}
                    </p>
                  </div>

                  <strong
                    className={
                      pronosticoFinalizado
                        ? pronosticoAcertado
                          ? "saved-prediction-score"
                          : "saved-prediction-failed"
                        : "saved-prediction-pending"
                    }
                  >
                    {etiquetaEstado}
                  </strong>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="profile-section profile-favorites-section">
        <div className="profile-favorites-heading">
          <div>
            <p className="section-label">PERSONALIZACION</p>
            <h2>Mis favoritos</h2>
          </div>
          <Heart size={22} />
        </div>

        <p className="profile-favorites-help">
          Estos equipos y torneos aparecen primero en Inicio y generan avisos
          personalizados.
        </p>

        {favoritosMensaje && (
          <p className="profile-favorites-error">{favoritosMensaje}</p>
        )}

        {favorites.loading ? (
          <article className="no-predictions-card">Cargando favoritos...</article>
        ) : favorites.teams.length === 0 &&
          favorites.competitions.length === 0 ? (
          <article className="no-predictions-card">
            Aún no sigues equipos ni torneos. Puedes agregarlos desde el
            detalle de cualquier partido.
          </article>
        ) : (
          <div className="profile-favorite-groups">
            <div>
              <strong>Equipos</strong>
              <div className="profile-favorite-chips">
                {favorites.teams.map((team) => (
                  <button
                    type="button"
                    onClick={() => quitarFavorito("equipo", team.team_name)}
                    disabled={favorites.savingKey === `team:${team.team_key}`}
                    key={team.id}
                    title={`Dejar de seguir a ${team.team_name}`}
                  >
                    <TeamLogo teamName={team.team_name} size="small" />
                    {team.team_name}
                    <X size={14} />
                  </button>
                ))}
                {favorites.teams.length === 0 && <span>Sin equipos</span>}
              </div>
            </div>

            <div>
              <strong>Torneos</strong>
              <div className="profile-favorite-chips">
                {favorites.competitions.map((competition) => (
                  <button
                    type="button"
                    onClick={() =>
                      quitarFavorito("competicion", competition.competition_name)
                    }
                    disabled={
                      favorites.savingKey ===
                      `competition:${competition.competition_key}`
                    }
                    key={competition.id}
                    title={`Dejar de seguir ${competition.competition_name}`}
                  >
                    {competition.competition_name}
                    <X size={14} />
                  </button>
                ))}
                {favorites.competitions.length === 0 && <span>Sin torneos</span>}
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        className={`achievement-card ${
          tienePrimerAcierto ? "achievement-unlocked" : ""
        }`}
      >
        <div className="achievement-icon">
          <Award size={22} />
        </div>

        <div>
          <p className="section-label">{logro.etiqueta}</p>
          <h3>{logro.titulo}</h3>
          <span>{logro.descripcion}</span>
        </div>

        <button
          type="button"
          className="profile-analytics-link"
          onClick={() => navigate("/estadisticas")}
        >
          <BarChart3 size={17} />
          Ver analítica completa
        </button>
      </section>

      {esAdmin && (
        <section className="achievement-card admin-shortcut-card">
          <div>
            <p className="section-label">ADMINISTRACIÓN</p>
            <h3>Panel operativo</h3>
            <span>Revisa sistema, modelo, predicciones, datasets y premium.</span>
          </div>

          <button type="button" onClick={() => navigate("/admin")}>
            Abrir panel
          </button>
        </section>
      )}

      {profile && !esAdmin && (
        <section className="achievement-card admin-shortcut-card">
          <div>
            <p className="section-label">CONFIGURACIÓN INICIAL</p>
            <h3>Activar primer admin</h3>
            <span>Solo funciona si aún no existe un administrador.</span>
          </div>

          <button
            type="button"
            onClick={reclamarPrimerAdmin}
            disabled={activandoAdmin}
          >
            {activandoAdmin ? "Activando..." : "Activar"}
          </button>
        </section>
      )}

      <BottomNavigation activePage="perfil" />
    </main>
  );
}

export default ProfilePage;

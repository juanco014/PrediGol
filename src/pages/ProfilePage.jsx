import { useState } from "react";
import { Award, Flame, LogOut, Target, Trophy } from "lucide-react";
import BottomNavigation from "../components/BottomNavigation";
import { obtenerEstadisticas } from "../utils/estadisticas";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { supabase } from "../lib/supabase";
import { useProfile } from "../hooks/useProfile";


function ProfilePage({ session }) {
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const estadisticasPrediGol = obtenerEstadisticas();
  const { profile } = useProfile(session?.user?.id);

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

const { posicionUsuario } = obtenerRankingGlobal(usuarioActual);
  const cerrarSesion = async () => {
    try {
      setCerrandoSesion(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error) {
      window.alert(
        error.message || "No fue posible cerrar sesión. Inténtalo de nuevo."
      );
    } finally {
      setCerrandoSesion(false);
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

        {estadisticasPrediGol.resumen.length === 0 ? (
          <article className="no-predictions-card">
            Aún no has guardado pronósticos. Ve a Partidos y demuestra que
            sabes de fútbol.
          </article>
        ) : (
          <div className="saved-predictions-list">
            {estadisticasPrediGol.resumen.map((pronostico) => (
              <article className="saved-prediction-card" key={pronostico.id}>
                <div>
                  <p className="saved-prediction-tournament">
                    {pronostico.torneo}
                  </p>

                  <h3>
                    {pronostico.local} vs {pronostico.visitante}
                  </h3>

                  <p className="saved-prediction-detail">
                    Tu pronóstico: {pronostico.marcador}
                    {pronostico.resultadoFinal &&
                      ` · Resultado final: ${pronostico.resultadoFinal.local} - ${pronostico.resultadoFinal.visitante}`}
                  </p>
                </div>

                <strong
                  className={
                    pronostico.estado === "finalizado"
                      ? "saved-prediction-score"
                      : "saved-prediction-pending"
                  }
                >
                  {pronostico.estado === "finalizado"
                    ? `+${pronostico.puntos} pts`
                    : "Pendiente"}
                </strong>
              </article>
            ))}
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
      </section>

      <BottomNavigation activePage="perfil" />
    </main>
  );
}

export default ProfilePage;
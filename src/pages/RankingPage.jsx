import { Crown, Medal, Target, Trophy } from "lucide-react";
import BottomNavigation from "../components/BottomNavigation";
import { obtenerEstadisticas } from "../utils/estadisticas";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { useProfile } from "../hooks/useProfile";


  const estadisticas = obtenerEstadisticas();
function RankingPage({ session }) {
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
  puntosTotales: estadisticas.puntosTotales,
  aciertos: estadisticas.aciertos,
  nombre: nombreCompleto,
  usuario: username,
  avatar: inicialUsuario,
});

  const { ranking, posicionUsuario, mensajePosicion } =
    obtenerRankingGlobal(usuarioActual);

  return (
    <main className="ranking-page">
      <header className="ranking-header">
        <p className="brand">PREDIGOL</p>
        <h1>Ranking global</h1>
        <p>
          Compite con la comunidad, suma puntos y demuestra que sabes de
          fútbol.
        </p>
      </header>

      <section className="ranking-user-card">
        <div className="ranking-user-position">
          <Medal size={22} />
          <span>Tu posición</span>
          <strong>#{posicionUsuario}</strong>
        </div>

        <div className="ranking-user-divider" />

        <div className="ranking-user-points">
          <span>Tus puntos</span>
          <strong>{usuarioActual.puntos}</strong>
        </div>

        <p>{mensajePosicion}</p>
      </section>

      <section className="ranking-section-header">
        <div>
          <p className="section-label">CLASIFICACIÓN GENERAL</p>
          <h2>Los mejores de PrediGol</h2>
        </div>

        <span>{ranking.length} jugadores</span>
      </section>

      <section className="ranking-list">
        {ranking.map((jugador, index) => {
          const posicion = index + 1;
          const esPodio = posicion <= 3;

          return (
            <article
              className={`ranking-card ${
                jugador.esUsuarioActual ? "ranking-card-current-user" : ""
              }`}
              key={jugador.id}
            >
              <div
                className={`ranking-position ${
                  esPodio ? `ranking-position-${posicion}` : ""
                }`}
              >
                {posicion === 1 ? (
                  <Crown size={19} />
                ) : (
                  <span>#{posicion}</span>
                )}
              </div>

              <div className="ranking-avatar">{jugador.avatar}</div>

              <div className="ranking-player-info">
                <h3>
                  {jugador.nombre}
                  {jugador.esUsuarioActual && (
                    <span className="you-badge">Tú</span>
                  )}
                </h3>

                <p>
                  {jugador.usuario} · {jugador.aciertos}{" "}
                  {jugador.aciertos === 1 ? "acierto" : "aciertos"}
                </p>
              </div>

              <div className="ranking-points">
                <strong>{jugador.puntos}</strong>
                <span>pts</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="ranking-info-card">
        <div className="ranking-info-icon">
          <Target size={21} />
        </div>

        <div>
          <p className="section-label">¿CÓMO SUBIR?</p>
          <h3>Acumula más aciertos</h3>
          <span>
            Acierta marcadores exactos para obtener 5 puntos y subir más rápido
            en la tabla.
          </span>
        </div>

        <Trophy className="ranking-trophy" size={28} />
      </section>

      <BottomNavigation activePage="ranking" />
    </main>
  );
}

export default RankingPage;
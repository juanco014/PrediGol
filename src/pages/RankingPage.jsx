import { useEffect, useState } from "react";
import { Crown, Medal, Target, Trophy } from "lucide-react";
import BottomNavigation from "../components/BottomNavigation";
import {
  estadisticasVacias,
  obtenerEstadisticasSupabase,
} from "../utils/estadisticasSupabase";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { obtenerRankingGlobalSupabase } from "../utils/rankingSupabase";
import { useProfile } from "../hooks/useProfile";

function RankingPage({ session }) {
  const [estadisticas, setEstadisticas] = useState(estadisticasVacias);
  const [rankingSupabase, setRankingSupabase] = useState([]);
  const [rankingError, setRankingError] = useState("");

  const usuarioId = session?.user?.id;
  const { profile } = useProfile(usuarioId);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    Promise.allSettled([
      obtenerEstadisticasSupabase(usuarioId),
      obtenerRankingGlobalSupabase(usuarioId),
    ])
      .then(([resultadoEstadisticas, resultadoRanking]) => {
        if (respuestaCancelada) {
          return;
        }

        if (resultadoEstadisticas.status === "fulfilled") {
          setEstadisticas(resultadoEstadisticas.value);
        } else {
          console.error(
            "Error al cargar estadisticas del ranking:",
            resultadoEstadisticas.reason
          );
        }

        if (resultadoRanking.status === "fulfilled") {
          setRankingSupabase(resultadoRanking.value);
          setRankingError("");
        } else {
          console.error("Error al cargar ranking global:", resultadoRanking.reason);
          setRankingError(
            "Ranking global en modo local hasta actualizar las funciones de Supabase."
          );
        }
      })
      .catch((error) => {
        console.error("Error al cargar ranking:", error);
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
    puntosTotales: estadisticas.puntosTotales,
    aciertos: estadisticas.aciertos,
    nombre: nombreCompleto,
    usuario: username,
    avatar: inicialUsuario,
  });

  const rankingLocal = obtenerRankingGlobal(usuarioActual);
  const ranking =
    rankingSupabase.length > 0 ? rankingSupabase : rankingLocal.ranking;
  const jugadorActualRanking =
    ranking.find((jugador) => jugador.esUsuarioActual) || usuarioActual;
  const posicionUsuario =
    jugadorActualRanking.posicion || rankingLocal.posicionUsuario;
  const indiceUsuario = ranking.findIndex((jugador) => jugador.esUsuarioActual);
  const jugadorEncima = indiceUsuario > 0 ? ranking[indiceUsuario - 1] : null;
  const puntosParaSubir = jugadorEncima
    ? Math.max(1, jugadorEncima.puntos - jugadorActualRanking.puntos + 1)
    : 0;
  const mensajePosicion =
    rankingSupabase.length > 0
      ? jugadorEncima
        ? `Te faltan ${puntosParaSubir} ${
            puntosParaSubir === 1 ? "punto" : "puntos"
          } para subir una posicion.`
        : "Vas liderando el ranking global."
      : rankingLocal.mensajePosicion;

  return (
    <main className="ranking-page">
      <header className="ranking-header">
        <p className="brand">PREDIGOL</p>
        <h1>Ranking global</h1>
        <p>
          Compite con la comunidad, suma puntos y demuestra que sabes de futbol.
        </p>
      </header>

      {rankingError && <p className="prediction-message">{rankingError}</p>}

      <section className="ranking-user-card">
        <div className="ranking-user-position">
          <Medal size={22} />
          <span>Tu posicion</span>
          <strong>#{posicionUsuario}</strong>
        </div>

        <div className="ranking-user-divider" />

        <div className="ranking-user-points">
          <span>Tus puntos</span>
          <strong>{jugadorActualRanking.puntos}</strong>
        </div>

        <p>{mensajePosicion}</p>
      </section>

      <section className="ranking-section-header">
        <div>
          <p className="section-label">CLASIFICACION GENERAL</p>
          <h2>Los mejores de PrediGol</h2>
        </div>

        <span>{ranking.length} jugadores</span>
      </section>

      <section className="ranking-list">
        {ranking.map((jugador, index) => {
          const posicion = jugador.posicion || index + 1;
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
                    <span className="you-badge">Tu</span>
                  )}
                </h3>

                <p>
                  {jugador.usuario} - {jugador.aciertos}{" "}
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
          <p className="section-label">COMO SUBIR</p>
          <h3>Acumula mas aciertos</h3>
          <span>
            Suma 3 puntos por acertar ganador o empate, 1 extra por diferencia
            de goles y 5 puntos por marcador exacto.
          </span>
        </div>

        <Trophy className="ranking-trophy" size={28} />
      </section>

      <BottomNavigation activePage="ranking" />
    </main>
  );
}

export default RankingPage;

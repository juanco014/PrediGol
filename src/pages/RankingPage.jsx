import { useEffect, useState } from "react";
import {
  CalendarRange,
  Crown,
  Medal,
  ShieldCheck,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import BottomNavigation from "../components/BottomNavigation";
import {
  estadisticasVacias,
  obtenerEstadisticasSupabase,
} from "../utils/estadisticasSupabase";
import {
  crearUsuarioRanking,
  obtenerRankingGlobal,
} from "../utils/ranking";
import { obtenerRankingSegmentadoSupabase } from "../utils/rankingSupabase";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";

function RankingPage({ session }) {
  const [estadisticas, setEstadisticas] = useState(estadisticasVacias);
  const [rankingSupabase, setRankingSupabase] = useState([]);
  const [rankingError, setRankingError] = useState("");
  const [periodo, setPeriodo] = useState("global");
  const [torneo, setTorneo] = useState("");
  const [torneos, setTorneos] = useState([]);
  const [cargandoRanking, setCargandoRanking] = useState(true);

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
      periodo === "torneo" && !torneo
        ? Promise.resolve([])
        : obtenerRankingSegmentadoSupabase(usuarioId, { periodo, torneo }),
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
            "No fue posible cargar este ranking. Revisa la migracion de Supabase."
          );
        }

        setCargandoRanking(false);
      })
      .catch((error) => {
        console.error("Error al cargar ranking:", error);
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [periodo, torneo, usuarioId]);

  useEffect(() => {
    let active = true;

    supabase
      .from("partidos")
      .select("torneo")
      .eq("estado", "finalizado")
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) {
          const options = [...new Set((data || []).map((item) => item.torneo).filter(Boolean))].sort();
          setTorneos(options);
          setTorneo((current) => current || options[0] || "");
        }
      })
      .catch((error) => console.error("Error al cargar torneos del ranking:", error));

    return () => {
      active = false;
    };
  }, []);

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
    rankingSupabase.length > 0
      ? rankingSupabase
      : periodo === "global"
        ? rankingLocal.ranking
        : [];
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

  const periodoTitulo =
    periodo === "semanal"
      ? "Ranking de la semana"
      : periodo === "torneo"
        ? `Ranking de ${torneo || "torneo"}`
        : "Ranking global";

  const logros = [
    {
      nombre: "Debutante",
      descripcion: "Guarda tu primer pronostico.",
      desbloqueado: jugadorActualRanking.pronosticos >= 1,
      icono: Target,
    },
    {
      nombre: "Primer acierto",
      descripcion: "Suma puntos por primera vez.",
      desbloqueado: jugadorActualRanking.aciertos >= 1,
      icono: ShieldCheck,
    },
    {
      nombre: "Marcador perfecto",
      descripcion: "Acierta un resultado exacto.",
      desbloqueado: jugadorActualRanking.exactos >= 1,
      icono: Star,
    },
    {
      nombre: "Podio PrediGol",
      descripcion: "Alcanza el top 3 de la clasificacion.",
      desbloqueado: posicionUsuario > 0 && posicionUsuario <= 3,
      icono: Medal,
    },
  ];

  return (
    <main className="ranking-page">
      <header className="ranking-header">
        <p className="brand">PREDIGOL</p>
        <h1>{periodoTitulo}</h1>
        <p>
          Compite con la comunidad, suma puntos y demuestra que sabes de futbol.
        </p>
      </header>

      {rankingError && <p className="prediction-message">{rankingError}</p>}

      <section className="ranking-scope-panel">
        <div className="ranking-scope-tabs" aria-label="Tipo de ranking">
          {[
            ["global", "Global", Trophy],
            ["semanal", "Esta semana", CalendarRange],
            ["torneo", "Por torneo", Medal],
          ].map(([value, label, Icon]) => (
            <button
              type="button"
              className={periodo === value ? "ranking-scope-active" : ""}
              onClick={() => {
                setCargandoRanking(true);
                setPeriodo(value);
              }}
              key={value}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {periodo === "torneo" && (
          <select
            value={torneo}
            onChange={(event) => {
              setCargandoRanking(true);
              setTorneo(event.target.value);
            }}
          >
            {torneos.length === 0 && <option value="">Sin torneos finalizados</option>}
            {torneos.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        )}
      </section>

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

      <section className="ranking-list" aria-busy={cargandoRanking}>
        {cargandoRanking && <p className="ranking-loading">Actualizando clasificacion...</p>}
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

      <section className="ranking-achievements">
        <div className="ranking-section-header">
          <div>
            <p className="section-label">MIS LOGROS</p>
            <h2>Insignias de temporada</h2>
          </div>
          <span>{logros.filter((logro) => logro.desbloqueado).length}/{logros.length}</span>
        </div>

        <div className="ranking-achievement-grid">
          {logros.map((logro) => {
            const Icon = logro.icono;
            return (
              <article className={logro.desbloqueado ? "achievement-earned" : ""} key={logro.nombre}>
                <Icon size={20} />
                <strong>{logro.nombre}</strong>
                <span>{logro.descripcion}</span>
                <small>{logro.desbloqueado ? "Desbloqueado" : "Pendiente"}</small>
              </article>
            );
          })}
        </div>
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

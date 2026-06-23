import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Crown, Trophy, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import { supabase } from "../lib/supabase";

function obtenerInicial(nombre) {
  return nombre?.trim().charAt(0).toUpperCase() || "J";
}

function LigaDetailPage({ session }) {
  const { ligaId } = useParams();
  const navigate = useNavigate();

  const [detalle, setDetalle] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const usuarioId = session?.user?.id;

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId || !ligaId) {
      return undefined;
    }

    Promise.all([
      supabase.rpc("obtener_detalle_liga", {
        p_liga_id: ligaId,
      }),
      supabase.rpc("obtener_ranking_liga", {
        p_liga_id: ligaId,
      }),
    ])
      .then(([respuestaDetalle, respuestaRanking]) => {
        if (respuestaDetalle.error) {
          throw respuestaDetalle.error;
        }

        if (respuestaRanking.error) {
          throw respuestaRanking.error;
        }

        const detalleLiga = respuestaDetalle.data?.[0];

        if (!detalleLiga) {
          throw new Error("No encontramos esta liga.");
        }

        if (!respuestaCancelada) {
          setDetalle(detalleLiga);
          setRanking(respuestaRanking.data || []);
        }
      })
      .catch((errorActual) => {
        console.error("Error al cargar el detalle de la liga:", errorActual);

        if (!respuestaCancelada) {
          setError(
            errorActual.message ||
              "No fue posible cargar la información de esta liga."
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
  }, [ligaId, usuarioId]);

  const copiarCodigo = async () => {
    if (!detalle?.codigo) {
      return;
    }

    try {
      await navigator.clipboard.writeText(detalle.codigo);
      setMensaje("Código copiado. Compártelo con tus amigos.");
    } catch {
      setMensaje(`Código de invitación: ${detalle.codigo}`);
    }
  };

  const jugadorActual = ranking.find(
    (jugador) => jugador.usuario_id === usuarioId
  );

  if (cargando) {
    return (
      <main className="league-detail-page">
        <p className="brand">PREDIGOL</p>

        <section className="empty-league-card">
          <p>Cargando competencia...</p>
          <span>Estamos organizando la tabla de posiciones.</span>
        </section>

        <BottomNavigation activePage="ligas" />
      </main>
    );
  }

  if (error || !detalle) {
    return (
      <main className="league-detail-page">
        <button
          className="league-back-button"
          type="button"
          onClick={() => navigate("/ligas")}
        >
          <ArrowLeft size={19} />
          Volver a ligas
        </button>

        <section className="empty-league-card">
          <p>No pudimos abrir esta liga.</p>
          <span>{error || "La liga no existe o no haces parte de ella."}</span>
        </section>

        <BottomNavigation activePage="ligas" />
      </main>
    );
  }

  return (
    <main className="league-detail-page">
      <button
        className="league-back-button"
        type="button"
        onClick={() => navigate("/ligas")}
      >
        <ArrowLeft size={19} />
        Volver a ligas
      </button>

      <header className="league-detail-header">
        <p className="brand">PREDIGOL</p>
        <h1>{detalle.nombre}</h1>
        <p>Compite, suma puntos y llega a lo más alto de la tabla.</p>
      </header>

      <section className="league-code-card">
        <div>
          <span>Código de invitación</span>
          <strong>{detalle.codigo}</strong>
        </div>

        <button type="button" onClick={copiarCodigo}>
          <Copy size={18} />
          Copiar
        </button>
      </section>

      {mensaje && <p className="league-page-message">{mensaje}</p>}

      <section className="league-private-summary">
        <div>
          <span>Tu posición</span>
          <strong>#{jugadorActual?.posicion ?? "—"}</strong>
        </div>

        <div className="league-private-divider" />

        <div>
          <span>Tus puntos</span>
          <strong>{jugadorActual?.puntos ?? 0}</strong>
        </div>
      </section>

      <section className="league-detail-section-header">
        <div>
          <p className="section-label">TABLA DE POSICIONES</p>
          <h2>Ranking de la liga</h2>
        </div>

        <span>
          <Users size={17} />
          {detalle.participantes}{" "}
          {detalle.participantes === 1 ? "jugador" : "jugadores"}
        </span>
      </section>

      <section className="league-ranking-list">
        {ranking.map((jugador) => {
          const esUsuarioActual = jugador.usuario_id === usuarioId;
          const esLider = jugador.posicion === 1;

          return (
            <article
              className={`league-ranking-card ${
                esUsuarioActual ? "league-ranking-card-current" : ""
              }`}
              key={jugador.usuario_id}
            >
              <div
                className={`league-ranking-position ${
                  esLider ? "league-ranking-position-first" : ""
                }`}
              >
                {esLider ? (
                  <Crown size={19} />
                ) : (
                  <span>#{jugador.posicion}</span>
                )}
              </div>

              <div className="league-ranking-avatar">
                {obtenerInicial(jugador.nombre)}
              </div>

              <div className="league-ranking-player">
                <h3>
                  {jugador.nombre}
                  {esUsuarioActual && <span className="you-badge">Tú</span>}
                </h3>

                <p>
                  {jugador.username ? `@${jugador.username}` : "Jugador PrediGol"}{" "}
                  · {jugador.aciertos}{" "}
                  {jugador.aciertos === 1 ? "acierto" : "aciertos"}
                </p>
              </div>

              <div className="league-ranking-points">
                <strong>{jugador.puntos}</strong>
                <span>pts</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="league-detail-tip">
        <Trophy size={22} />

        <div>
          <p className="section-label">¿CÓMO GANAR?</p>
          <h3>Acumula más aciertos</h3>
          <span>
            Acertar ganador o empate suma 3 puntos. La diferencia correcta da
            1 extra y el marcador exacto suma 5.
          </span>
        </div>
      </section>

      <BottomNavigation activePage="ligas" />
    </main>
  );
}

export default LigaDetailPage;

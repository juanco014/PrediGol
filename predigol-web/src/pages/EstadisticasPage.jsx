import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Medal,
  Share2,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import { useProfile } from "../hooks/useProfile";
import { compartirContenido } from "../utils/shareContent";
import {
  estadisticasVacias,
  obtenerEstadisticasSupabase,
} from "../utils/estadisticasSupabase";

function EstadisticasPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const { profile } = useProfile(usuarioId);
  const [estadisticas, setEstadisticas] = useState(estadisticasVacias);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let active = true;

    obtenerEstadisticasSupabase(usuarioId)
      .then((data) => {
        if (active) {
          setEstadisticas(data);
          setError("");
        }
      })
      .catch((queryError) => {
        console.error("Error al cargar analitica personal:", queryError);
        if (active) setError(queryError.message || "No fue posible calcular tu rendimiento.");
      })
      .finally(() => {
        if (active) setCargando(false);
      });

    return () => {
      active = false;
    };
  }, [usuarioId]);

  const finalizados = useMemo(
    () => estadisticas.resumen.filter((item) => item.estado === "finalizado"),
    [estadisticas.resumen]
  );

  const porTorneo = useMemo(() => {
    const map = new Map();
    finalizados.forEach((item) => {
      const current = map.get(item.torneo) || {
        torneo: item.torneo,
        pronosticos: 0,
        puntos: 0,
        aciertos: 0,
        exactos: 0,
      };
      current.pronosticos += 1;
      current.puntos += item.puntos;
      if (item.puntos > 0) current.aciertos += 1;
      if (item.marcadorExacto) current.exactos += 1;
      map.set(item.torneo, current);
    });
    return [...map.values()].sort((a, b) => b.puntos - a.puntos);
  }, [finalizados]);

  const puntosPosibles = finalizados.length * 5;
  const rendimientoPuntos = puntosPosibles > 0
    ? Math.round((estadisticas.puntosTotales / puntosPosibles) * 100)
    : 0;
  const exactos = finalizados.filter((item) => item.marcadorExacto).length;
  const diferencias = finalizados.filter(
    (item) => item.aciertaDiferencia && !item.marcadorExacto
  ).length;
  const simples = finalizados.filter(
    (item) => item.puntos === 3
  ).length;

  const compartirProgreso = async () => {
    const nombre = profile?.nombre || "Hincha PrediGol";
    try {
      const result = await compartirContenido({
        title: "Mi rendimiento en PrediGol",
        text: `${nombre} lleva ${estadisticas.puntosTotales} puntos, ${estadisticas.aciertos} aciertos y ${exactos} marcadores exactos en PrediGol.`,
        url: `${window.location.origin}/ranking`,
      });
      setMensaje(result === "copied" ? "Resumen copiado al portapapeles." : "Progreso compartido.");
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setMensaje(shareError.message || "No fue posible compartir tu progreso.");
      }
    }
  };

  return (
    <main className="analytics-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/perfil")}>
        <ArrowLeft size={19} /> Volver al perfil
      </button>

      <header className="analytics-header">
        <div>
          <p className="brand">PREDIGOL</p>
          <h1>Mi rendimiento</h1>
          <p>Descubre en que torneos aciertas mas y como estas sumando puntos.</p>
        </div>
        <button type="button" onClick={compartirProgreso}>
          <Share2 size={17} /> Compartir progreso
        </button>
      </header>

      {mensaje && <p className="analytics-message">{mensaje}</p>}

      {cargando ? (
        <LoadingState cards={4} label="Calculando tu rendimiento" />
      ) : error ? (
        <section className="empty-league-card"><p>No pudimos calcular tus estadisticas.</p><span>{error}</span></section>
      ) : (
        <>
          <section className="analytics-kpis">
            {[
              ["Puntos", estadisticas.puntosTotales, Trophy],
              ["Efectividad", `${estadisticas.porcentajeAciertos}%`, Target],
              ["Exactos", exactos, CheckCircle2],
              ["Racha", estadisticas.rachaActual, Medal],
            ].map(([label, value, Icon]) => (
              <article key={label}><Icon size={19} /><strong>{value}</strong><span>{label}</span></article>
            ))}
          </section>

          <section className="analytics-grid">
            <article className="analytics-card">
              <div className="analytics-title"><BarChart3 size={19} /><h2>Calidad de aciertos</h2></div>
              <div className="analytics-quality">
                {[
                  ["Marcador exacto", exactos, finalizados.length],
                  ["Diferencia correcta", diferencias, finalizados.length],
                  ["Ganador o empate", simples, finalizados.length],
                  ["Rendimiento de puntos", rendimientoPuntos, 100],
                ].map(([label, value, total]) => {
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <span><b>{label}</b><strong>{label === "Rendimiento de puntos" ? `${value}%` : value}</strong></span>
                      <div><i style={{ width: `${percentage}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="analytics-card">
              <div className="analytics-title"><Trophy size={19} /><h2>Rendimiento por torneo</h2></div>
              {porTorneo.length === 0 ? (
                <p className="entity-empty">Cierra algunos partidos para ver esta comparacion.</p>
              ) : (
                <div className="analytics-tournament-list">
                  {porTorneo.map((item) => (
                    <div key={item.torneo}>
                      <span><strong>{item.torneo}</strong><small>{item.aciertos}/{item.pronosticos} aciertos</small></span>
                      <b>{item.puntos} pts</b>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="analytics-card analytics-recent">
            <div className="analytics-title"><Target size={19} /><h2>Ultimos resultados</h2></div>
            {finalizados.length === 0 ? (
              <p className="entity-empty">Todavia no tienes pronosticos resueltos.</p>
            ) : (
              <div>{finalizados.slice(0, 8).map((item) => (
                <button type="button" onClick={() => navigate(`/partidos/${item.id}`)} key={item.id}>
                  <span>{item.torneo}</span>
                  <strong>{item.local} vs {item.visitante}</strong>
                  <b className={item.puntos > 0 ? "analytics-points-win" : ""}>+{item.puntos}</b>
                </button>
              ))}</div>
            )}
          </section>
        </>
      )}

      <BottomNavigation activePage="perfil" />
    </main>
  );
}

export default EstadisticasPage;

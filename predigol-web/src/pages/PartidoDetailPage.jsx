import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Heart,
  History,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import TeamLogo from "../components/TeamLogo";
import { useFavorites, normalizarClaveFavorito } from "../hooks/useFavorites";
import { obtenerDetallePartido } from "../services/footballApi";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos";

const MATCH_TABS = [
  { id: "resumen", label: "Resumen", icon: Activity },
  { id: "pronostico", label: "Pronóstico", icon: Target },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  { id: "historial", label: "Historial", icon: History },
];

function formatearFecha(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(fecha));
}

function formatearPorcentaje(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${Math.round(numero * 100)}%` : "0%";
}

function explicarPrediccion(prediccion) {
  if (!prediccion) {
    return "";
  }

  const opciones = [
    ["victoria local", Number(prediccion.home_win_probability)],
    ["empate", Number(prediccion.draw_probability)],
    ["victoria visitante", Number(prediccion.away_win_probability)],
  ].sort((a, b) => b[1] - a[1]);
  const ventaja = opciones[0][1] - opciones[1][1];
  const muestras =
    Number(prediccion.metadata?.home_samples || 0) +
    Number(prediccion.metadata?.away_samples || 0);

  if (ventaja < 0.08) {
    return "El modelo ve un partido muy parejo; ninguna opción tiene una ventaja clara.";
  }

  const evidencia =
    muestras < 6
      ? " La muestra reciente es limitada, así que conviene interpretar esta estimación con cautela."
      : " La estimación combina goles esperados, rendimiento de local/visitante y fuerza Elo.";

  return `La opción con mayor probabilidad es ${opciones[0][0]} con ${formatearPorcentaje(
    opciones[0][1]
  )}.${evidencia}`;
}

function etiquetaEstado(partido, ahora) {
  if (!partido) return "Sin estado";
  if (partido.estado === "cancelado") return "Cancelado";
  if (partido.estado === "en_vivo") {
    return partido.minuto ? `En vivo - ${partido.minuto}'` : "En vivo";
  }
  if (partido.estado === "finalizado") return "Finalizado";
  return partidoAceptaPronosticos(partido, ahora)
    ? "Acepta pronósticos"
    : "Cerrado";
}

function obtenerForma(historial, equipo) {
  const claveEquipo = normalizarClaveFavorito(equipo);

  return historial
    .filter((item) =>
      [item.local_nombre, item.visitante_nombre]
        .map(normalizarClaveFavorito)
        .includes(claveEquipo)
    )
    .slice(0, 5)
    .map((item) => {
      const esLocal = normalizarClaveFavorito(item.local_nombre) === claveEquipo;
      const golesFavor = Number(
        esLocal ? item.goles_local_final : item.goles_visitante_final
      );
      const golesContra = Number(
        esLocal ? item.goles_visitante_final : item.goles_local_final
      );

      if (golesFavor > golesContra) return "G";
      if (golesFavor === golesContra) return "E";
      return "P";
    });
}

function ProbabilityBar({ label, value }) {
  const percentage = Math.max(0, Math.min(100, Math.round(Number(value) * 100)));

  return (
    <div className="match-probability-row">
      <div>
        <span>{label}</span>
        <strong>{percentage}%</strong>
      </div>
      <div className="match-probability-track">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function PartidoDetailPage({ session }) {
  const { partidoId } = useParams();
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [activeTab, setActiveTab] = useState("resumen");
  const [momentoActual, setMomentoActual] = useState(() => new Date());
  const favorites = useFavorites(usuarioId);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!partidoId || !usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerDetallePartido(partidoId, usuarioId)
      .then((datos) => {
        if (!respuestaCancelada) {
          setDetalle(datos);
          setMensaje("");
        }
      })
      .catch((error) => {
        console.error("Error al cargar detalle del partido:", error);
        if (!respuestaCancelada) {
          setMensaje(error.message || "No fue posible cargar el partido.");
        }
      })
      .finally(() => {
        if (!respuestaCancelada) setCargando(false);
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [partidoId, usuarioId]);

  useEffect(() => {
    const intervalo = window.setInterval(
      () => setMomentoActual(new Date()),
      30000
    );
    return () => window.clearInterval(intervalo);
  }, []);

  const partido = detalle?.partido;
  const pronostico = detalle?.pronostico;
  const prediccionModelo = detalle?.prediccionModelo;
  const historial = useMemo(() => detalle?.historial || [], [detalle?.historial]);
  const snapshots = detalle?.snapshots || [];

  const detallePuntaje = useMemo(() => {
    if (!partido?.resultadoFinal || !pronostico) return null;
    return calcularDetallePuntaje(
      { local: pronostico.goles_local, visitante: pronostico.goles_visitante },
      partido.resultadoFinal
    );
  }, [partido, pronostico]);

  const formaLocal = useMemo(
    () => obtenerForma(historial, partido?.local),
    [historial, partido?.local]
  );
  const formaVisitante = useMemo(
    () => obtenerForma(historial, partido?.visitante),
    [historial, partido?.visitante]
  );
  const enfrentamientosDirectos = useMemo(() => {
    if (!partido) return [];
    const equipos = new Set([
      normalizarClaveFavorito(partido.local),
      normalizarClaveFavorito(partido.visitante),
    ]);
    return historial
      .filter(
        (item) =>
          equipos.has(normalizarClaveFavorito(item.local_nombre)) &&
          equipos.has(normalizarClaveFavorito(item.visitante_nombre))
      )
      .slice(0, 5);
  }, [historial, partido]);

  const puedePronosticar = partido
    ? partidoAceptaPronosticos(partido, momentoActual)
    : false;
  const cuentaRegresiva = puedePronosticar
    ? obtenerCuentaRegresiva(partido.fechaOrden, momentoActual)
    : null;
  const pasoFlujo =
    partido?.estado === "finalizado"
      ? 3
      : pronostico
        ? 2
        : puedePronosticar
          ? 1
          : 0;

  const cambiarFavorito = async (tipo, nombre) => {
    try {
      if (tipo === "equipo") await favorites.toggleTeam(nombre);
      else await favorites.toggleCompetition(nombre);
      setMensaje("");
    } catch (error) {
      setMensaje(error.message || "No fue posible actualizar tus favoritos.");
    }
  };

  return (
    <main className="match-detail-page">
      <button
        className="league-back-button"
        type="button"
        onClick={() => navigate("/inicio")}
      >
        <ArrowLeft size={19} />
        Volver a Inicio
      </button>

      {cargando ? (
        <section className="empty-league-card">
          <p>Cargando partido...</p>
          <span>Estamos preparando el detalle.</span>
        </section>
      ) : mensaje && !partido ? (
        <section className="empty-league-card">
          <p>No pudimos abrir este partido.</p>
          <span>{mensaje}</span>
        </section>
      ) : !partido ? null : (
        <>
          <header className="match-detail-hero">
            <p className="brand">PREDIGOL PARTIDO</p>
            <div className="match-detail-topline">
              <span>{partido.torneo}</span>
              <strong>{etiquetaEstado(partido, momentoActual)}</strong>
            </div>

            <section className="match-detail-scoreboard">
              <div>
                <TeamLogo teamName={partido.local} logoUrl={partido.localLogoUrl} size="large" />
                <h1>{partido.local}</h1>
              </div>
              <div className="match-detail-score">
                <strong>
                  {partido.resultadoFinal
                    ? `${partido.resultadoFinal.local} - ${partido.resultadoFinal.visitante}`
                    : "VS"}
                </strong>
                <span>{formatearFecha(partido.fechaOrden)}</span>
                {cuentaRegresiva && (
                  <em
                    className={
                      cuentaRegresiva.urgente
                        ? "match-detail-countdown-urgent"
                        : ""
                    }
                  >
                    {cuentaRegresiva.texto}
                  </em>
                )}
              </div>
              <div>
                <TeamLogo teamName={partido.visitante} logoUrl={partido.visitanteLogoUrl} size="large" />
                <h1>{partido.visitante}</h1>
              </div>
            </section>

            <div className="match-favorite-actions">
              {[
                ["equipo", partido.local, favorites.isTeamFavorite(partido.local)],
                ["competicion", partido.torneo, favorites.isCompetitionFavorite(partido.torneo)],
                ["equipo", partido.visitante, favorites.isTeamFavorite(partido.visitante)],
              ].map(([tipo, nombre, activo]) => {
                const savingKey = `${tipo === "equipo" ? "team" : "competition"}:${normalizarClaveFavorito(nombre)}`;
                return (
                  <button
                    type="button"
                    className={activo ? "match-favorite-active" : ""}
                    disabled={favorites.savingKey === savingKey}
                    onClick={() => cambiarFavorito(tipo, nombre)}
                    key={`${tipo}-${nombre}`}
                  >
                    <Heart size={15} fill={activo ? "currentColor" : "none"} />
                    {tipo === "equipo" ? nombre : "Seguir torneo"}
                  </button>
                );
              })}
            </div>

            <div className="match-detail-meta">
              <span>{partido.ronda || "Sin ronda"}</span>
              <span>Temporada {partido.temporada || "N/D"}</span>
              <span>{partido.origenDatos || "manual"}</span>
            </div>
          </header>

          {mensaje && <p className="match-inline-message">{mensaje}</p>}

          <section className="match-detail-actions">
            <div>
              <p className="section-label">SIGUIENTE PASO</p>
              <strong>
                {partido.estado === "finalizado"
                  ? "Revisa los puntos obtenidos con tu marcador."
                  : pronostico
                    ? "Tu marcador está guardado y puedes editarlo mientras siga abierto."
                    : puedePronosticar
                      ? "Guarda tu marcador antes del inicio."
                      : "Este partido ya no admite nuevos pronósticos."}
              </strong>
            </div>
            <div className="match-detail-action-buttons">
              {puedePronosticar && (
                <button type="button" onClick={() => navigate("/inicio")}>
                  {pronostico ? "Editar en Inicio" : "Crear pronóstico"}
                </button>
              )}
              {pronostico && (
                <button
                  type="button"
                  className="match-detail-secondary-action"
                  onClick={() => navigate("/pronosticos")}
                >
                  Mis pronósticos
                </button>
              )}
            </div>
          </section>

          <nav className="match-detail-tabs" aria-label="Secciones del partido">
            {MATCH_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  className={activeTab === tab.id ? "match-tab-active" : ""}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  key={tab.id}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeTab === "resumen" && (
            <>
            <section className="match-flow-card" aria-label="Flujo del pronóstico">
                {[
                  ["1", "Pronostica"],
                  ["2", "Espera el resultado"],
                  ["3", "Suma puntos"],
                ].map(([numero, etiqueta], indice) => (
                  <article
                    key={numero}
                    className={indice + 1 <= pasoFlujo ? "match-flow-active" : ""}
                  >
                    <b>{numero}</b>
                    <span>{etiqueta}</span>
                  </article>
                ))}
              </section>

              <section className="match-detail-grid">
                <article className="match-detail-card">
                  <div className="match-detail-card-title">
                    <Target size={19} />
                    <h2>Tu pronóstico</h2>
                  </div>
                  {pronostico ? (
                    <>
                      <strong className="match-detail-user-score">
                        {pronostico.goles_local} - {pronostico.goles_visitante}
                      </strong>
                      <span>Guardado {formatearFecha(pronostico.actualizado_en)}</span>
                      {detallePuntaje && (
                        <p>
                          {detallePuntaje.puntos > 0
                            ? `Acertado: +${detallePuntaje.puntos} puntos`
                            : "Fallado: +0 puntos"}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>No has guardado pronóstico para este partido.</p>
                  )}
                </article>

                <article className="match-detail-card">
                  <div className="match-detail-card-title">
                    <BarChart3 size={19} />
                    <h2>Modelo PrediGol</h2>
                  </div>
                  {prediccionModelo ? (
                    <>
                      <strong className="match-detail-user-score">
                        {prediccionModelo.predicted_home_goals} -{" "}
                        {prediccionModelo.predicted_away_goals}
                      </strong>
                      <p>{explicarPrediccion(prediccionModelo)}</p>
                      <span>
                        {prediccionModelo.model_version} - Confianza {formatearPorcentaje(prediccionModelo.confidence)}
                      </span>
                      {(prediccionModelo.metadata?.warnings || []).slice(0, 2).map((warning) => (
                        <small key={warning}>{warning}</small>
                      ))}
                    </>
                  ) : (
                    <p>Aún no hay predicción guardada para este partido.</p>
                  )}
                </article>

                <article className="match-detail-card">
                  <div className="match-detail-card-title">
                    <CalendarClock size={19} />
                    <h2>Estado del juego</h2>
                  </div>
                  <p>
                    {puedePronosticar
                      ? "El partido sigue abierto para pronósticos."
                      : "Los pronósticos están cerrados para este partido."}
                  </p>
                  <span>{partido.fuenteDetalle || "Sin fuente adicional"}</span>
                </article>
              </section>

              <section className="match-timeline-section">
                <div className="match-detail-card-title">
                  <Activity size={19} />
                  <h2>Cronología en vivo</h2>
                </div>
                {snapshots.length === 0 ? (
                  <article className="match-history-empty">
                    La cronología quedó preparada. Aparecerá al recibir datos en vivo de API-Football.
                  </article>
                ) : (
                  <div className="match-timeline-list">
                    {snapshots.map((snapshot) => (
                      <article key={snapshot.id}>
                        <b>{snapshot.elapsed ? `${snapshot.elapsed}'` : "Actualización"}</b>
                        <span>{snapshot.status || snapshot.status_short}</span>
                        <strong>{snapshot.goals_home ?? 0} - {snapshot.goals_away ?? 0}</strong>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "pronostico" && (
            <>
              <section className="match-detail-card match-prediction-focus">
                <div className="match-detail-card-title">
                  <Target size={19} />
                  <h2>Tu marcador</h2>
                </div>
                {pronostico ? (
                  <>
                    <strong className="match-detail-user-score">
                      {pronostico.goles_local} - {pronostico.goles_visitante}
                    </strong>
                    <p>
                      {detallePuntaje
                        ? `Resultado: ${detallePuntaje.puntos} puntos obtenidos.`
                        : "Tu pronóstico está guardado y pendiente del resultado."}
                    </p>
                  </>
                ) : (
                  <p>
                    {puedePronosticar
                      ? "Todavía estás a tiempo de guardar tu marcador desde Inicio."
                      : "No guardaste marcador antes del cierre."}
                  </p>
                )}
              </section>
              <section className="match-scoring-guide">
                <div>
                  <p className="section-label">CÓMO SUMAS</p>
                  <h2>Guía rápida de puntos</h2>
                </div>
                <div className="match-scoring-grid">
                  <article><strong>5 pts</strong><span>Marcador exacto</span></article>
                  <article><strong>3 pts</strong><span>Aciertas ganador o empate</span></article>
                  <article><strong>+1 pt</strong><span>Aciertas tambien la diferencia</span></article>
                </div>
              </section>
            </>
          )}

          {activeTab === "estadisticas" && (
            <section className="match-statistics-layout">
              <article className="match-detail-card">
                <div className="match-detail-card-title">
                  <BarChart3 size={19} />
                  <h2>Probabilidades 1X2</h2>
                </div>
                {prediccionModelo ? (
                  <div className="match-probability-list">
                    <ProbabilityBar label={partido.local} value={prediccionModelo.home_win_probability} />
                    <ProbabilityBar label="Empate" value={prediccionModelo.draw_probability} />
                    <ProbabilityBar label={partido.visitante} value={prediccionModelo.away_win_probability} />
                  </div>
                ) : (
                  <p>No hay datos del modelo para comparar.</p>
                )}
              </article>

              <article className="match-detail-card">
                <div className="match-detail-card-title">
                  <Activity size={19} />
                  <h2>Poisson y Elo</h2>
                </div>
                {prediccionModelo ? (
                  <div className="match-model-metrics">
                    <span><b>{Number(prediccionModelo.expected_home_goals).toFixed(2)}</b> xG local</span>
                    <span><b>{Number(prediccionModelo.expected_away_goals).toFixed(2)}</b> xG visitante</span>
                    <span><b>{prediccionModelo.metadata?.home_rating || "N/D"}</b> Elo local</span>
                    <span><b>{prediccionModelo.metadata?.away_rating || "N/D"}</b> Elo visitante</span>
                    <span><b>{prediccionModelo.metadata?.home_samples || 0}</b> muestras local</span>
                    <span><b>{prediccionModelo.metadata?.away_samples || 0}</b> muestras visitante</span>
                  </div>
                ) : (
                  <p>Estos indicadores aparecerán después de ejecutar el modelo.</p>
                )}
              </article>

              <article className="match-detail-card match-form-card">
                <div className="match-detail-card-title">
                  <Trophy size={19} />
                  <h2>Forma reciente</h2>
                </div>
                {[[partido.local, formaLocal], [partido.visitante, formaVisitante]].map(([equipo, forma]) => (
                  <div className="match-form-row" key={equipo}>
                    <strong>{equipo}</strong>
                    <div>
                      {forma.length > 0 ? forma.map((resultado, index) => (
                        <span className={`form-${resultado.toLowerCase()}`} key={`${equipo}-${index}`}>{resultado}</span>
                      )) : <small>Sin datos</small>}
                    </div>
                  </div>
                ))}
              </article>
            </section>
          )}

          {activeTab === "historial" && (
            <section className="match-history-section">
              <div className="match-detail-card-title">
                <Trophy size={19} />
                <h2>Enfrentamientos directos</h2>
              </div>
              {enfrentamientosDirectos.length === 0 ? (
                <article className="match-history-empty">
                  No hay enfrentamientos directos cargados entre estos equipos.
                </article>
              ) : (
                <div className="match-history-list">
                  {enfrentamientosDirectos.map((item) => (
                    <article className="match-history-row" key={item.id}>
                      <div>
                        <span>{item.torneo}</span>
                        <strong>{item.local_nombre} vs {item.visitante_nombre}</strong>
                        <small>{formatearFecha(item.fecha_orden)}</small>
                      </div>
                      <b>{item.goles_local_final} - {item.goles_visitante_final}</b>
                    </article>
                  ))}
                </div>
              )}

              <div className="match-detail-card-title match-history-subtitle">
                <History size={19} />
                <h2>Partidos recientes de ambos equipos</h2>
              </div>
              {historial.length === 0 ? (
                <article className="match-history-empty">
                  No hay partidos finalizados recientes para estos equipos.
                </article>
              ) : (
                <div className="match-history-list">
                  {historial.map((item) => (
                    <article className="match-history-row" key={item.id}>
                      <div>
                        <span>{item.torneo}</span>
                        <strong>{item.local_nombre} vs {item.visitante_nombre}</strong>
                        <small>{formatearFecha(item.fecha_orden)}</small>
                      </div>
                      <b>{item.goles_local_final} - {item.goles_visitante_final}</b>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <BottomNavigation activePage="partidos" />
    </main>
  );
}

export default PartidoDetailPage;

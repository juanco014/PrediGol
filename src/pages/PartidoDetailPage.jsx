import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CalendarClock, Target, Trophy } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import { supabase } from "../lib/supabase";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos";

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

  if (!Number.isFinite(numero)) {
    return "0%";
  }

  return `${Math.round(numero * 100)}%`;
}

function adaptarPartido(partido) {
  return {
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
    ronda: partido.ronda,
    temporada: partido.temporada,
    origenDatos: partido.origen_datos,
    fuenteDetalle: partido.fuente_detalle,
    minuto: partido.minuto,
    resultadoFinal:
      partido.estado === "finalizado"
        ? {
            local: partido.goles_local_final,
            visitante: partido.goles_visitante_final,
          }
        : null,
  };
}

function etiquetaEstado(partido, ahora) {
  if (!partido) {
    return "Sin estado";
  }

  if (partido.estado === "cancelado") {
    return "Cancelado";
  }

  if (partido.estado === "en_vivo") {
    return partido.minuto ? `En vivo - ${partido.minuto}'` : "En vivo";
  }

  if (partido.estado === "finalizado") {
    return "Finalizado";
  }

  return partidoAceptaPronosticos(partido, ahora) ? "Acepta pronosticos" : "Cerrado";
}

async function consultarPartidoDetalle(partidoId, usuarioId) {
  const { data: partidoData, error: partidoError } = await supabase
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
        ronda,
        temporada,
        origen_datos,
        fuente_detalle
      `
    )
    .eq("id", partidoId)
    .maybeSingle();

  if (partidoError) {
    throw partidoError;
  }

  if (!partidoData) {
    throw new Error("No encontramos este partido.");
  }

  const partido = adaptarPartido(partidoData);

  const consultas = [
    supabase
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante, actualizado_en")
      .eq("usuario_id", usuarioId)
      .eq("partido_id", partido.id)
      .maybeSingle(),
    supabase
      .from("partidos")
      .select(
        `
          id,
          torneo,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          estado,
          goles_local_final,
          goles_visitante_final
        `
      )
      .eq("estado", "finalizado")
      .not("goles_local_final", "is", null)
      .not("goles_visitante_final", "is", null)
      .in("local_nombre", [partido.local, partido.visitante])
      .order("fecha_orden", { ascending: false })
      .limit(8),
    supabase
      .from("partidos")
      .select(
        `
          id,
          torneo,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          estado,
          goles_local_final,
          goles_visitante_final
        `
      )
      .eq("estado", "finalizado")
      .not("goles_local_final", "is", null)
      .not("goles_visitante_final", "is", null)
      .in("visitante_nombre", [partido.local, partido.visitante])
      .order("fecha_orden", { ascending: false })
      .limit(8),
  ];

  if (partido.apiFootballFixtureId) {
    consultas.push(
      supabase
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
        .eq("api_football_fixture_id", partido.apiFootballFixtureId)
        .maybeSingle()
    );
  }

  const [respuestaPronostico, respuestaHistorialLocal, respuestaHistorialVisitante, respuestaModelo] =
    await Promise.all(consultas);

  if (respuestaPronostico.error) {
    throw respuestaPronostico.error;
  }

  if (respuestaHistorialLocal.error) {
    throw respuestaHistorialLocal.error;
  }

  if (respuestaHistorialVisitante.error) {
    throw respuestaHistorialVisitante.error;
  }

  if (respuestaModelo?.error) {
    throw respuestaModelo.error;
  }

  const historialMap = new Map();

  [...(respuestaHistorialLocal.data || []), ...(respuestaHistorialVisitante.data || [])]
    .filter((item) => item.id !== partido.id)
    .forEach((item) => {
      historialMap.set(item.id, item);
    });

  const historial = [...historialMap.values()]
    .sort((a, b) => new Date(b.fecha_orden).getTime() - new Date(a.fecha_orden).getTime())
    .slice(0, 6);

  return {
    partido,
    pronostico: respuestaPronostico.data,
    prediccionModelo: respuestaModelo?.data || null,
    historial,
  };
}

function PartidoDetailPage({ session }) {
  const { partidoId } = useParams();
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const [detalle, setDetalle] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [momentoActual, setMomentoActual] = useState(() => new Date());

  useEffect(() => {
    let respuestaCancelada = false;

    if (!partidoId || !usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    consultarPartidoDetalle(partidoId, usuarioId)
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
        if (!respuestaCancelada) {
          setCargando(false);
        }
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [partidoId, usuarioId]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setMomentoActual(new Date());
    }, 30000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, []);

  const partido = detalle?.partido;
  const pronostico = detalle?.pronostico;
  const prediccionModelo = detalle?.prediccionModelo;
  const historial = detalle?.historial || [];

  const detallePuntaje = useMemo(() => {
    if (!partido?.resultadoFinal || !pronostico) {
      return null;
    }

    return calcularDetallePuntaje(
      {
        local: pronostico.goles_local,
        visitante: pronostico.goles_visitante,
      },
      partido.resultadoFinal
    );
  }, [partido, pronostico]);

  const puedePronosticar = partido ? partidoAceptaPronosticos(partido, momentoActual) : false;
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

  return (
    <main className="match-detail-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/inicio")}>
        <ArrowLeft size={19} />
        Volver a Inicio
      </button>

      {cargando ? (
        <section className="empty-league-card">
          <p>Cargando partido...</p>
          <span>Estamos preparando el detalle.</span>
        </section>
      ) : mensaje || !partido ? (
        <section className="empty-league-card">
          <p>No pudimos abrir este partido.</p>
          <span>{mensaje || "El partido no existe o ya no esta disponible."}</span>
        </section>
      ) : (
        <>
          <header className="match-detail-hero">
            <p className="brand">PREDIGOL PARTIDO</p>
            <div className="match-detail-topline">
              <span>{partido.torneo}</span>
              <strong>{etiquetaEstado(partido, momentoActual)}</strong>
            </div>

            <section className="match-detail-scoreboard">
              <div>
                <b>{partido.localShort}</b>
                <h1>{partido.local}</h1>
              </div>

              <div className="match-detail-score">
                {partido.resultadoFinal ? (
                  <strong>
                    {partido.resultadoFinal.local} - {partido.resultadoFinal.visitante}
                  </strong>
                ) : (
                  <strong>VS</strong>
                )}
                <span>{formatearFecha(partido.fechaOrden)}</span>
                {cuentaRegresiva && (
                  <em
                    className={
                      cuentaRegresiva.urgente ? "match-detail-countdown-urgent" : ""
                    }
                  >
                    {cuentaRegresiva.texto}
                  </em>
                )}
              </div>

              <div>
                <b>{partido.visitanteShort}</b>
                <h1>{partido.visitante}</h1>
              </div>
            </section>

            <div className="match-detail-meta">
              <span>{partido.ronda || "Sin ronda"}</span>
              <span>Temporada {partido.temporada || "N/D"}</span>
              <span>{partido.origenDatos || "manual"}</span>
            </div>
          </header>

          <section className="match-detail-actions">
            <div>
              <p className="section-label">SIGUIENTE PASO</p>
              <strong>
                {partido.estado === "finalizado"
                  ? "Revisa los puntos obtenidos con tu marcador."
                  : pronostico
                    ? "Tu marcador esta guardado. Puedes editarlo mientras siga abierto."
                    : puedePronosticar
                      ? "Guarda tu marcador antes del inicio."
                      : "Este partido ya no admite nuevos pronosticos."}
              </strong>
            </div>

            <div className="match-detail-action-buttons">
              {puedePronosticar && (
                <button type="button" onClick={() => navigate("/inicio")}>
                  {pronostico ? "Editar en Inicio" : "Crear pronostico"}
                </button>
              )}
              {pronostico && (
                <button
                  type="button"
                  className="match-detail-secondary-action"
                  onClick={() => navigate("/pronosticos")}
                >
                  Mis pronosticos
                </button>
              )}
            </div>
          </section>

          <section className="match-flow-card" aria-label="Flujo del pronostico">
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
                <h2>Tu pronostico</h2>
              </div>

              {pronostico ? (
                <>
                  <strong className="match-detail-user-score">
                    {pronostico.goles_local} - {pronostico.goles_visitante}
                  </strong>
                  <span>
                    Guardado {pronostico.actualizado_en ? formatearFecha(pronostico.actualizado_en) : ""}
                  </span>
                  {detallePuntaje && (
                    <p>
                      {detallePuntaje.estado === "acertado"
                        ? `Acertado: +${detallePuntaje.puntos} puntos`
                        : "Fallado: +0 puntos"}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>No has guardado pronostico para este partido.</p>
                  <span>
                    {puedePronosticar
                      ? "Vuelve a Inicio para guardar tu marcador."
                      : "El partido ya no acepta pronosticos."}
                  </span>
                </>
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
                  <div className="match-detail-probabilities">
                    <span>Local {formatearPorcentaje(prediccionModelo.home_win_probability)}</span>
                    <span>Empate {formatearPorcentaje(prediccionModelo.draw_probability)}</span>
                    <span>
                      Visitante {formatearPorcentaje(prediccionModelo.away_win_probability)}
                    </span>
                  </div>
                  <p>
                    Confianza {formatearPorcentaje(prediccionModelo.confidence)} -{" "}
                    {prediccionModelo.model_version}
                  </p>
                </>
              ) : (
                <>
                  <p>Aun no hay prediccion guardada para este partido.</p>
                  <span>Cuando corra el modelo, aparecera aqui y en Inicio.</span>
                </>
              )}
            </article>

            <article className="match-detail-card">
              <div className="match-detail-card-title">
                <CalendarClock size={19} />
                <h2>Estado del juego</h2>
              </div>

              <p>
                {puedePronosticar
                  ? "El partido sigue abierto para pronosticos."
                  : "Los pronosticos estan cerrados para este partido."}
              </p>
              <span>{partido.fuenteDetalle || "Sin fuente adicional"}</span>
            </article>
          </section>

          <section className="match-scoring-guide">
            <div>
              <p className="section-label">COMO SUMAS</p>
              <h2>Guia rapida de puntos</h2>
            </div>

            <div className="match-scoring-grid">
              <article>
                <strong>5 pts</strong>
                <span>Marcador exacto</span>
              </article>
              <article>
                <strong>3 pts</strong>
                <span>Aciertas ganador o empate</span>
              </article>
              <article>
                <strong>+1 pt</strong>
                <span>Aciertas tambien la diferencia</span>
              </article>
            </div>
          </section>

          <section className="match-history-section">
            <div className="match-detail-card-title">
              <Trophy size={19} />
              <h2>Historial reciente</h2>
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
                      <strong>
                        {item.local_nombre} vs {item.visitante_nombre}
                      </strong>
                      <small>{formatearFecha(item.fecha_orden)}</small>
                    </div>

                    <b>
                      {item.goles_local_final} - {item.goles_visitante_final}
                    </b>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <BottomNavigation activePage="partidos" />
    </main>
  );
}

export default PartidoDetailPage;

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import TeamLogo from "../components/TeamLogo";
import {
  estadisticasVacias,
  obtenerEstadisticasUsuario,
} from "../services/predictionStatsApi";
import { obtenerPronosticosModelo } from "../services/footballApi";

const filtrosPronosticos = [
  {
    id: "todos",
    label: "Todos",
    coincide: () => true,
  },
  {
    id: "pendientes",
    label: "Pendientes",
    coincide: (pronostico) => pronostico.estado !== "finalizado",
  },
  {
    id: "acertados",
    label: "Acertados",
    coincide: (pronostico) =>
      pronostico.estado === "finalizado" &&
      pronostico.estadoPronostico === "acertado",
  },
  {
    id: "exactos",
    label: "Exactos",
    coincide: (pronostico) => pronostico.marcadorExacto,
  },
  {
    id: "fallados",
    label: "Fallados",
    coincide: (pronostico) =>
      pronostico.estado === "finalizado" &&
      pronostico.estadoPronostico !== "acertado",
  },
];

const filtrosFechaModelo = [
  { id: "todos", label: "Todas" },
  { id: "hoy", label: "Hoy" },
  { id: "proximos", label: "Proximos" },
];

function formatearFecha(fechaOrden) {
  if (!fechaOrden) {
    return "Fecha por definir";
  }

  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fechaOrden));
}

function obtenerEstadoVisual(pronostico) {
  if (pronostico.estado !== "finalizado") {
    return {
      label: "Pendiente",
      className: "saved-prediction-pending",
    };
  }

  if (pronostico.marcadorExacto) {
    return {
      label: `Exacto +${pronostico.puntos} pts`,
      className: "saved-prediction-exact",
    };
  }

  if (pronostico.estadoPronostico === "acertado") {
    return {
      label: pronostico.aciertaDiferencia
        ? `Diferencia +${pronostico.puntos} pts`
        : `Acertado +${pronostico.puntos} pts`,
      className: "saved-prediction-score",
    };
  }

  return {
    label: "Fallado +0 pts",
    className: "saved-prediction-failed",
  };
}

function formatearProbabilidad(valor) {
  return `${Math.round(Number(valor || 0) * 100)}%`;
}

function esMismoDia(fechaOrden, referencia) {
  if (!fechaOrden) return false;
  const fecha = new Date(fechaOrden);
  return !Number.isNaN(fecha.getTime()) && fecha.toDateString() === referencia.toDateString();
}

function PronosticosPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const [estadisticasPrediGol, setEstadisticasPrediGol] =
    useState(estadisticasVacias);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pronosticosModelo, setPronosticosModelo] = useState([]);
  const [ligaModelo, setLigaModelo] = useState("todos");
  const [tipoModelo, setTipoModelo] = useState("todos");
  const [fechaModelo, setFechaModelo] = useState("todos");
  const [busquedaModelo, setBusquedaModelo] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    Promise.all([obtenerEstadisticasUsuario(usuarioId), obtenerPronosticosModelo()])
      .then(([estadisticas, modelo]) => {
        if (!respuestaCancelada) {
          setEstadisticasPrediGol(estadisticas);
          setPronosticosModelo(modelo);
          setError("");
        }
      })
      .catch((errorCarga) => {
        console.error("Error al cargar pronósticos:", errorCarga);

        if (!respuestaCancelada) {
          setError(
            errorCarga.message ||
              "No fue posible cargar tus pronósticos. Inténtalo de nuevo."
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
  }, [usuarioId]);

  const filtroSeleccionado =
    filtrosPronosticos.find((filtro) => filtro.id === filtroActivo) ||
    filtrosPronosticos[0];

  const busquedaNormalizada = busqueda.trim().toLowerCase();

  const pronosticosFiltrados = useMemo(() => {
    return estadisticasPrediGol.resumen.filter((pronostico) => {
      const coincideFiltro = filtroSeleccionado.coincide(pronostico);

      if (!coincideFiltro) {
        return false;
      }

      if (!busquedaNormalizada) {
        return true;
      }

      const textoBusqueda = [
        pronostico.torneo,
        pronostico.local,
        pronostico.visitante,
        pronostico.estado,
      ]
        .join(" ")
        .toLowerCase();

      return textoBusqueda.includes(busquedaNormalizada);
    });
  }, [
    busquedaNormalizada,
    estadisticasPrediGol.resumen,
    filtroSeleccionado,
  ]);

  const resumen = [
    {
      label: "Pronósticos",
      value: estadisticasPrediGol.totalPronosticos,
    },
    {
      label: "Puntos",
      value: estadisticasPrediGol.puntosTotales,
    },
    {
      label: "Aciertos",
      value: estadisticasPrediGol.aciertos,
    },
    {
      label: "Efectividad",
      value: `${estadisticasPrediGol.porcentajeAciertos}%`,
    },
  ];

  const ligasModelo = useMemo(
    () => ["todos", ...new Set(pronosticosModelo.map((item) => item.liga).filter(Boolean))],
    [pronosticosModelo]
  );

  const pronosticosModeloFiltrados = useMemo(() => {
    const busqueda = busquedaModelo.trim().toLowerCase();
    const ahora = new Date();
    return pronosticosModelo.filter((pronostico) => {
      const coincideLiga = ligaModelo === "todos" || pronostico.liga === ligaModelo;
      const coincideTipo = tipoModelo === "todos" || pronostico.accessTier === tipoModelo;
      const coincideBusqueda = !busqueda || [pronostico.local, pronostico.visitante, pronostico.liga]
        .join(" ")
        .toLowerCase()
        .includes(busqueda);
      const fechaPartido = pronostico.fechaOrden ? new Date(pronostico.fechaOrden) : null;
      const coincideFecha = fechaModelo === "todos"
        || (fechaModelo === "hoy" && esMismoDia(pronostico.fechaOrden, ahora))
        || (fechaModelo === "proximos" && fechaPartido && fechaPartido >= ahora);
      return coincideLiga && coincideTipo && coincideBusqueda && coincideFecha;
    });
  }, [busquedaModelo, fechaModelo, ligaModelo, pronosticosModelo, tipoModelo]);

  const limpiarFiltrosModelo = () => {
    setLigaModelo("todos");
    setTipoModelo("todos");
    setFechaModelo("todos");
    setBusquedaModelo("");
  };

  return (
    <main className="predictions-page">
      <header className="predictions-header">
        <button
          type="button"
          className="back-link"
          onClick={() => navigate("/inicio")}
        >
          <ArrowLeft size={18} />
          Inicio
        </button>

        <p className="brand">PREDIGOL</p>
        <h1>Mis pronósticos</h1>
        <p>
          Consulta pronosticos gratuitos del modelo principal y revisa tus marcadores guardados.
        </p>
      </header>

      <section className="responsible-note predictions-responsible-note">
        Los pronosticos de PrediGol son estimaciones estadisticas con fines informativos y no garantizan resultados deportivos.
      </section>

      <section className="predictions-summary-card">
        {resumen.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="profile-section predictions-section">
        <div className="predictions-section-heading">
          <div>
            <p className="section-label">MODELO PRINCIPAL</p>
            <h2>Pronósticos PrediGol</h2>
          </div>

          <strong>V1 producción</strong>
        </div>

        <p className="profile-helper-text">
          Predicciones informativas generadas por el modelo principal V1. V2 se mantiene experimental y no se muestra al usuario final.
        </p>

        <div className="model-prediction-filters" aria-label="Filtrar pronosticos del modelo">
          <label>
            <span>Liga</span>
            <select value={ligaModelo} onChange={(evento) => setLigaModelo(evento.target.value)}>
              {ligasModelo.map((liga) => (
                <option value={liga} key={liga}>{liga === "todos" ? "Todas las ligas" : liga}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Equipo</span>
            <input
              type="search"
              value={busquedaModelo}
              onChange={(evento) => setBusquedaModelo(evento.target.value)}
              placeholder="Buscar equipo"
            />
          </label>
          <label>
            <span>Tipo</span>
            <select value={tipoModelo} onChange={(evento) => setTipoModelo(evento.target.value)}>
              <option value="todos">Todos</option>
              <option value="free">Gratis</option>
              <option value="premium_candidate">Premium candidato</option>
            </select>
          </label>
          <label>
            <span>Fecha</span>
            <select value={fechaModelo} onChange={(evento) => setFechaModelo(evento.target.value)}>
              {filtrosFechaModelo.map((filtro) => (
                <option value={filtro.id} key={filtro.id}>{filtro.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={limpiarFiltrosModelo}>Limpiar filtros</button>
        </div>

        {cargando ? (
          <LoadingState cards={3} label="Cargando pronósticos del modelo" />
        ) : error ? (
          <article className="no-predictions-card">No pudimos cargar los pronosticos. Revisa tu conexion e intenta nuevamente.</article>
        ) : pronosticosModelo.length === 0 ? (
          <article className="no-predictions-card">
            Todavia no hay pronosticos del modelo guardados para mostrar. Cuando el administrador ejecute el flujo de predicciones, apareceran aqui.
          </article>
        ) : pronosticosModeloFiltrados.length === 0 ? (
          <article className="no-predictions-card">
            No encontramos pronosticos con esos filtros. Limpia la busqueda o prueba otra liga.
          </article>
        ) : (
          <div className="saved-predictions-list">
            {pronosticosModeloFiltrados.map((pronostico) => (
              <article
                key={`${pronostico.apiFootballFixtureId}-${pronostico.generatedAt}`}
                className="saved-prediction-card"
                onClick={() => pronostico.partidoId && navigate(`/partidos/${pronostico.partidoId}`)}
              >
                <div className="saved-prediction-main">
                  <span>{pronostico.liga}</span>
                  <strong>
                    {pronostico.local} vs {pronostico.visitante}
                  </strong>
                  <small>{formatearFecha(pronostico.fechaOrden)}</small>
                </div>

                <div className="saved-prediction-scoreline">
                  <span>Local {formatearProbabilidad(pronostico.pHome)}</span>
                  <span>Empate {formatearProbabilidad(pronostico.pDraw)}</span>
                  <span>Visitante {formatearProbabilidad(pronostico.pAway)}</span>
                </div>

                <div className="saved-prediction-result">
                  <span className={pronostico.accessTier === "free" ? "saved-prediction-pending" : "saved-prediction-score"}>
                    {pronostico.accessTier === "free" ? "Gratis" : "Premium candidato"}
                  </span>
                  <strong>{pronostico.predictedOutcomeLabel}</strong>
                  <small>
                    Marcador probable {pronostico.probableScore || "por confirmar"} · confianza {pronostico.confidence ? formatearProbabilidad(pronostico.confidence) : "por confirmar"}
                  </small>
                  {pronostico.partidoId && (
                    <button type="button" onClick={(evento) => { evento.stopPropagation(); navigate(`/partidos/${pronostico.partidoId}`); }}>
                      Ver detalle
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="profile-section predictions-section">
        <div className="predictions-section-heading">
          <div>
            <p className="section-label">HISTORIAL</p>
            <h2>Tus jugadas guardadas</h2>
          </div>

          <strong>{pronosticosFiltrados.length} encontrados</strong>
        </div>

        <label className="predictions-search">
          <Search size={18} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por equipo o torneo"
          />
        </label>

        <div className="predictions-filter-bar" aria-label="Filtrar pronósticos">
          {filtrosPronosticos.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              className={
                filtroActivo === filtro.id ? "predictions-filter-active" : ""
              }
              onClick={() => setFiltroActivo(filtro.id)}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        {cargando ? (
          <LoadingState cards={3} label="Cargando tus pronósticos" />
        ) : error ? (
          <article className="no-predictions-card">{error}</article>
        ) : pronosticosFiltrados.length === 0 ? (
          <article className="no-predictions-card">
            Todavía no tienes pronósticos con este filtro. Ajusta la búsqueda o vuelve a
            Partidos para guardar uno nuevo.
          </article>
        ) : (
          <div className="saved-predictions-list">
            {pronosticosFiltrados.map((pronostico) => {
              const estadoVisual = obtenerEstadoVisual(pronostico);

              return (
                <article className="saved-prediction-card" key={pronostico.id}>
                  <div className="saved-prediction-main">
                    <p className="saved-prediction-tournament">
                      {pronostico.torneo} - {formatearFecha(pronostico.fechaOrden)}
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
                        ` - Resultado final: ${pronostico.resultadoFinal.local} - ${pronostico.resultadoFinal.visitante}`}
                    </p>
                  </div>

                  <div className="saved-prediction-actions">
                    <strong className={estadoVisual.className}>
                      {estadoVisual.label}
                    </strong>

                    <button
                      type="button"
                      onClick={() => navigate(`/partidos/${pronostico.id}`)}
                    >
                      Ver partido
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="achievement-card predictions-tip-card">
        <div className="achievement-icon">
          <Target size={22} />
        </div>

        <div>
          <p className="section-label">TIP PREDIGOL</p>
          <h3>Los pronósticos se bloquean cuando inicia el partido</h3>
          <p>
            Revisa fecha y hora antes de guardar. Si el partido ya finalizó, el
            sistema calcula puntos con el resultado real.
          </p>
        </div>
      </section>

      <BottomNavigation activePage="pronosticos" />
    </main>
  );
}

export default PronosticosPage;

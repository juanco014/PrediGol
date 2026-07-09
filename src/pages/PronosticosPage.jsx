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

function PronosticosPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const [estadisticasPrediGol, setEstadisticasPrediGol] =
    useState(estadisticasVacias);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

    obtenerEstadisticasUsuario(usuarioId)
      .then((estadisticas) => {
        if (!respuestaCancelada) {
          setEstadisticasPrediGol(estadisticas);
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
          Revisa tus marcadores guardados, filtra por resultado y abre el
          detalle de cualquier partido.
        </p>
      </header>

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

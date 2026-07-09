import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Heart,
  Search,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import { useFavorites } from "../hooks/useFavorites";
import { obtenerPartidosExplorador } from "../services/footballApi";
import {
  adaptarPartidoExplorador,
  crearRutaEntidad,
  formatearFechaPartido,
  normalizarTextoBusqueda,
} from "../utils/footballEntities";

const STATUS_FILTERS = [
  ["todos", "Todos"],
  ["proximo", "Próximos"],
  ["en_vivo", "En vivo"],
  ["finalizado", "Finalizados"],
];

function estadoPartido(partido) {
  if (partido.estado === "en_vivo") {
    return partido.minuto ? `En vivo ${partido.minuto}'` : "En vivo";
  }
  if (partido.estado === "finalizado") {
    return `${partido.golesLocal ?? 0} - ${partido.golesVisitante ?? 0}`;
  }
  if (partido.estado === "cancelado") return "Cancelado";
  return formatearFechaPartido(partido.fechaOrden);
}

function ExplorarPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const favorites = useFavorites(usuarioId);
  const { isCompetitionFavorite, isTeamFavorite } = favorites;
  const [partidos, setPartidos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDiferida = useDeferredValue(busqueda);
  const [estado, setEstado] = useState("todos");
  const [torneo, setTorneo] = useState("todos");
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    obtenerPartidosExplorador()
      .then((data) => {
        if (active) {
          setPartidos((data || []).map(adaptarPartidoExplorador));
          setError("");
        }
      })
      .catch((queryError) => {
        console.error("Error al explorar partidos:", queryError);
        if (active) setError(queryError.message || "No fue posible cargar partidos.");
      })
      .finally(() => {
        if (active) setCargando(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const torneos = useMemo(
    () => [...new Set(partidos.map((partido) => partido.torneo).filter(Boolean))].sort(),
    [partidos]
  );

  const partidosFiltrados = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaDiferida);
    const esFavorito = (partido) =>
      isTeamFavorite(partido.local) ||
      isTeamFavorite(partido.visitante) ||
      isCompetitionFavorite(partido.torneo);

    return partidos
      .filter((partido) => estado === "todos" || partido.estado === estado)
      .filter((partido) => torneo === "todos" || partido.torneo === torneo)
      .filter((partido) => !soloFavoritos || esFavorito(partido))
      .filter((partido) => !termino || partido.textoBusqueda.includes(termino))
      .sort((a, b) => {
        const favoriteDifference = Number(esFavorito(b)) - Number(esFavorito(a));
        if (favoriteDifference !== 0) return favoriteDifference;
        if (a.estado === "en_vivo" && b.estado !== "en_vivo") return -1;
        if (b.estado === "en_vivo" && a.estado !== "en_vivo") return 1;
        return b.fechaOrdenMs - a.fechaOrdenMs;
      });
  }, [
    busquedaDiferida,
    estado,
    isCompetitionFavorite,
    isTeamFavorite,
    partidos,
    soloFavoritos,
    torneo,
  ]);

  return (
    <main className="explore-page">
      <header className="explore-header">
        <div>
          <p className="brand">PREDIGOL</p>
          <h1>Explorar fútbol</h1>
          <p>Encuentra partidos, equipos y torneos desde un solo lugar.</p>
        </div>
        <Search size={30} />
      </header>

      <section className="explore-toolbar">
        <label className="explore-search">
          <Search size={18} />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar equipo, torneo o partido"
          />
        </label>

        <div className="explore-filters">
          <div>
            <SlidersHorizontal size={16} />
            {STATUS_FILTERS.map(([value, label]) => (
              <button
                type="button"
                className={estado === value ? "explore-filter-active" : ""}
                onClick={() => setEstado(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>

          <select value={torneo} onChange={(event) => setTorneo(event.target.value)}>
            <option value="todos">Todos los torneos</option>
            {torneos.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>

          <button
            type="button"
            className={soloFavoritos ? "explore-filter-active" : ""}
            onClick={() => setSoloFavoritos((current) => !current)}
          >
            <Heart size={15} fill={soloFavoritos ? "currentColor" : "none"} />
            Favoritos
          </button>
        </div>
      </section>

      <section className="explore-summary">
        <div>
          <CalendarDays size={18} />
          <strong>{partidosFiltrados.length}</strong>
          <span>partidos encontrados</span>
        </div>
        <button type="button" onClick={() => navigate("/ranking")}>Ver ranking</button>
      </section>

      {cargando || favorites.loading ? (
        <LoadingState cards={4} label="Buscando partidos" />
      ) : error ? (
        <section className="empty-league-card"><p>No pudimos explorar.</p><span>{error}</span></section>
      ) : partidosFiltrados.length === 0 ? (
        <section className="empty-league-card">
          <p>No encontramos resultados.</p>
          <span>Prueba con otro equipo, torneo o estado.</span>
        </section>
      ) : (
        <section className="explore-results">
          {partidosFiltrados.map((partido) => {
            const favorito =
              isTeamFavorite(partido.local) ||
              isTeamFavorite(partido.visitante) ||
              isCompetitionFavorite(partido.torneo);

            return (
              <article className="explore-match-card" key={partido.id}>
                <div className="explore-match-top">
                  <button
                    type="button"
                    onClick={() => navigate(crearRutaEntidad("torneo", partido.torneo))}
                  >
                    <Trophy size={14} />
                    {partido.torneo}
                  </button>
                  <span className={`explore-status explore-status-${partido.estado}`}>
                    {estadoPartido(partido)}
                  </span>
                </div>

                <div className="explore-teams">
                  <button
                    type="button"
                    onClick={() => navigate(crearRutaEntidad("equipo", partido.local))}
                  >
                    <b>{partido.localShort}</b>
                    <span>{partido.local}</span>
                  </button>
                  <strong>{partido.estado === "finalizado" ? `${partido.golesLocal} - ${partido.golesVisitante}` : "VS"}</strong>
                  <button
                    type="button"
                    onClick={() => navigate(crearRutaEntidad("equipo", partido.visitante))}
                  >
                    <b>{partido.visitanteShort}</b>
                    <span>{partido.visitante}</span>
                  </button>
                </div>

                <div className="explore-match-actions">
                  {favorito && <span><Heart size={13} fill="currentColor" /> Seguido</span>}
                  <button type="button" onClick={() => navigate(`/partidos/${partido.id}`)}>
                    Ver partido
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <BottomNavigation activePage="explorar" />
    </main>
  );
}

export default ExplorarPage;

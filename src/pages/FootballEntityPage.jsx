import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Heart, Shield, Target, Trophy } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import { useFavorites } from "../hooks/useFavorites";
import { supabase } from "../lib/supabase";
import {
  adaptarPartidoExplorador,
  crearRutaEntidad,
  formatearFechaPartido,
  leerNombreEntidad,
  normalizarTextoBusqueda,
  PARTIDO_EXPLORADOR_SELECT,
} from "../utils/footballEntities";

async function consultarEntidad(tipo, nombre) {
  if (tipo === "torneo") {
    const response = await supabase
      .from("partidos")
      .select(PARTIDO_EXPLORADOR_SELECT)
      .eq("torneo", nombre)
      .order("fecha_orden", { ascending: false })
      .limit(100);
    if (response.error) throw response.error;
    return (response.data || []).map(adaptarPartidoExplorador);
  }

  const [localResponse, awayResponse] = await Promise.all([
    supabase
      .from("partidos")
      .select(PARTIDO_EXPLORADOR_SELECT)
      .eq("local_nombre", nombre)
      .order("fecha_orden", { ascending: false })
      .limit(60),
    supabase
      .from("partidos")
      .select(PARTIDO_EXPLORADOR_SELECT)
      .eq("visitante_nombre", nombre)
      .order("fecha_orden", { ascending: false })
      .limit(60),
  ]);

  if (localResponse.error) throw localResponse.error;
  if (awayResponse.error) throw awayResponse.error;

  const unique = new Map();
  [...(localResponse.data || []), ...(awayResponse.data || [])]
    .map(adaptarPartidoExplorador)
    .forEach((partido) => unique.set(partido.id, partido));
  return [...unique.values()].sort(
    (a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime()
  );
}

function calcularResumenEquipo(partidos, nombre) {
  const clave = normalizarTextoBusqueda(nombre);
  return partidos
    .filter((partido) => partido.estado === "finalizado")
    .reduce(
      (summary, partido) => {
        const local = normalizarTextoBusqueda(partido.local) === clave;
        const favor = Number(local ? partido.golesLocal : partido.golesVisitante);
        const contra = Number(local ? partido.golesVisitante : partido.golesLocal);
        summary.jugados += 1;
        summary.golesFavor += favor;
        summary.golesContra += contra;
        if (favor > contra) summary.ganados += 1;
        else if (favor === contra) summary.empatados += 1;
        else summary.perdidos += 1;
        return summary;
      },
      { jugados: 0, ganados: 0, empatados: 0, perdidos: 0, golesFavor: 0, golesContra: 0 }
    );
}

function FootballEntityPage({ session, type }) {
  const { entityName } = useParams();
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const nombre = leerNombreEntidad(entityName);
  const esTorneo = type === "torneo";
  const favorites = useFavorites(usuarioId);
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    consultarEntidad(type, nombre)
      .then((items) => {
        if (active) {
          setPartidos(items);
          setError("");
        }
      })
      .catch((queryError) => {
        console.error("Error al cargar entidad de futbol:", queryError);
        if (active) setError(queryError.message || "No fue posible cargar esta pagina.");
      })
      .finally(() => {
        if (active) setCargando(false);
      });
    return () => { active = false; };
  }, [nombre, type]);

  const proximos = useMemo(
    () => partidos.filter((partido) => ["proximo", "en_vivo"].includes(partido.estado)).slice().reverse().slice(0, 8),
    [partidos]
  );
  const recientes = useMemo(
    () => partidos.filter((partido) => partido.estado === "finalizado").slice(0, 8),
    [partidos]
  );
  const equipos = useMemo(
    () => [...new Set(partidos.flatMap((partido) => [partido.local, partido.visitante]))].sort(),
    [partidos]
  );
  const resumenEquipo = useMemo(
    () => calcularResumenEquipo(partidos, nombre),
    [nombre, partidos]
  );
  const esFavorito = esTorneo
    ? favorites.isCompetitionFavorite(nombre)
    : favorites.isTeamFavorite(nombre);

  const toggleFavorite = async () => {
    try {
      if (esTorneo) await favorites.toggleCompetition(nombre);
      else await favorites.toggleTeam(nombre);
      setError("");
    } catch (favoriteError) {
      setError(favoriteError.message || "No fue posible actualizar el favorito.");
    }
  };

  const resumenTorneo = {
    partidos: partidos.filter((partido) => partido.estado === "finalizado").length,
    equipos: equipos.length,
    goles: partidos
      .filter((partido) => partido.estado === "finalizado")
      .reduce((total, partido) => total + Number(partido.golesLocal || 0) + Number(partido.golesVisitante || 0), 0),
  };

  return (
    <main className="entity-page">
      <button className="league-back-button" type="button" onClick={() => navigate("/explorar")}>
        <ArrowLeft size={19} /> Volver a Explorar
      </button>

      <header className="entity-hero">
        <div className="entity-symbol">{esTorneo ? <Trophy size={28} /> : <Shield size={28} />}</div>
        <div>
          <p className="section-label">{esTorneo ? "TORNEO" : "EQUIPO"}</p>
          <h1>{nombre}</h1>
          <span>{partidos.length} partidos disponibles en PrediGol</span>
        </div>
        <button
          type="button"
          className={esFavorito ? "entity-favorite-active" : ""}
          disabled={Boolean(favorites.savingKey)}
          onClick={toggleFavorite}
        >
          <Heart size={17} fill={esFavorito ? "currentColor" : "none"} />
          {esFavorito ? "Siguiendo" : "Seguir"}
        </button>
      </header>

      {error && <p className="prediction-message">{error}</p>}

      {cargando ? (
        <LoadingState cards={3} label="Cargando estadisticas" />
      ) : partidos.length === 0 ? (
        <section className="empty-league-card"><p>Sin datos disponibles.</p><span>Esta pagina se llenara al sincronizar partidos.</span></section>
      ) : (
        <>
          <section className="entity-stats-grid">
            {(esTorneo
              ? [["Partidos jugados", resumenTorneo.partidos], ["Equipos", resumenTorneo.equipos], ["Goles", resumenTorneo.goles]]
              : [["Jugados", resumenEquipo.jugados], ["Ganados", resumenEquipo.ganados], ["Empatados", resumenEquipo.empatados], ["Perdidos", resumenEquipo.perdidos], ["Goles a favor", resumenEquipo.golesFavor], ["Goles en contra", resumenEquipo.golesContra]]
            ).map(([label, value]) => (
              <article key={label}><strong>{value}</strong><span>{label}</span></article>
            ))}
          </section>

          {esTorneo && (
            <section className="entity-team-list">
              <div className="entity-section-title"><Shield size={18} /><h2>Equipos del torneo</h2></div>
              <div>{equipos.slice(0, 20).map((equipo) => (
                <button type="button" onClick={() => navigate(crearRutaEntidad("equipo", equipo))} key={equipo}>{equipo}</button>
              ))}</div>
            </section>
          )}

          <section className="entity-section">
            <div className="entity-section-title"><CalendarDays size={18} /><h2>Proximos partidos</h2></div>
            {proximos.length === 0 ? <p className="entity-empty">No hay partidos proximos cargados.</p> : (
              <div className="entity-match-list">{proximos.map((partido) => (
                <button type="button" onClick={() => navigate(`/partidos/${partido.id}`)} key={partido.id}>
                  <span>{partido.torneo}</span><strong>{partido.local} vs {partido.visitante}</strong><small>{formatearFechaPartido(partido.fechaOrden)}</small>
                </button>
              ))}</div>
            )}
          </section>

          <section className="entity-section">
            <div className="entity-section-title"><Target size={18} /><h2>Resultados recientes</h2></div>
            {recientes.length === 0 ? <p className="entity-empty">No hay resultados cargados.</p> : (
              <div className="entity-match-list">{recientes.map((partido) => (
                <button type="button" onClick={() => navigate(`/partidos/${partido.id}`)} key={partido.id}>
                  <span>{partido.torneo}</span><strong>{partido.local} {partido.golesLocal} - {partido.golesVisitante} {partido.visitante}</strong><small>{formatearFechaPartido(partido.fechaOrden)}</small>
                </button>
              ))}</div>
            )}
          </section>
        </>
      )}

      <BottomNavigation activePage="explorar" />
    </main>
  );
}

export default FootballEntityPage;

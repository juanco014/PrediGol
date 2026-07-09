import { supabase } from "../lib/supabase.js";
import { FOOTBALL_FIXTURES_SELECT, PARTIDOS_SELECT, obtenerPartidos } from "./footballApi.js";
import {
  buildEstadisticasUsuario,
  crearEstadisticasVacias,
  uniqueFinishedTournaments,
} from "./predictionStatsMappers.js";

export { crearEstadisticasVacias, estadisticasVacias } from "./predictionStatsMappers.js";

export async function obtenerPronosticosUsuario(usuarioId, client = supabase) {
  if (!usuarioId) return [];

  const { data, error } = await client
    .from("pronosticos")
    .select("id, usuario_id, partido_id, goles_local, goles_visitante")
    .eq("usuario_id", usuarioId);

  if (error) throw error;
  return data || [];
}

export async function obtenerHistorialPronosticosUsuario(usuarioId, client = supabase) {
  const pronosticos = await obtenerPronosticosUsuario(usuarioId, client);

  if (pronosticos.length === 0) return [];

  const partidoIds = [...new Set(pronosticos.map((pronostico) => pronostico.partido_id).filter(Boolean))];
  const { data, error } = await client
    .from("partidos")
    .select(PARTIDOS_SELECT)
    .in("id", partidoIds);

  if (error) throw error;

  const partidos = await obtenerPartidos(Promise.resolve({ data: data || [], error: null }), client);
  return buildEstadisticasUsuario(pronosticos, partidos).resumen;
}

export async function obtenerEstadisticasUsuario(usuarioId, client = supabase) {
  if (!usuarioId) return crearEstadisticasVacias();

  const pronosticos = await obtenerPronosticosUsuario(usuarioId, client);

  if (pronosticos.length === 0) return crearEstadisticasVacias();

  const partidoIds = [...new Set(pronosticos.map((pronostico) => pronostico.partido_id).filter(Boolean))];
  const { data, error } = await client
    .from("partidos")
    .select(PARTIDOS_SELECT)
    .in("id", partidoIds);

  if (error) throw error;

  const partidos = await obtenerPartidos(Promise.resolve({ data: data || [], error: null }), client);
  return buildEstadisticasUsuario(pronosticos, partidos);
}

export async function obtenerResumenPerfil(usuarioId, client = supabase) {
  return obtenerEstadisticasUsuario(usuarioId, client);
}

export async function obtenerTorneosFinalizados(client = supabase) {
  const fixturesResponse = await client
    .from("football_fixtures")
    .select(`${FOOTBALL_FIXTURES_SELECT}, football_competitions(name)`)
    .in("status_short", ["FT", "AET", "PEN"])
    .limit(500);

  if (!fixturesResponse.error && fixturesResponse.data?.length) {
    const torneos = fixturesResponse.data
      .map((fixture) => fixture.football_competitions?.name)
      .filter(Boolean);
    if (torneos.length > 0) return uniqueFinishedTournaments(torneos.map((name) => ({ name })));
  }

  const { data, error } = await client
    .from("partidos")
    .select("torneo")
    .eq("estado", "finalizado");

  if (error) throw error;
  return uniqueFinishedTournaments(data || []);
}

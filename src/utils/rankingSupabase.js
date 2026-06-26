import { supabase } from "../lib/supabase";

export function adaptarJugadorRankingSupabase(jugador, usuarioId) {
  const nombre = jugador.nombre || "Hincha PrediGol";
  const username = jugador.username ? `@${jugador.username}` : "@hincha_predigol";

  return {
    id: jugador.usuario_id,
    usuarioId: jugador.usuario_id,
    nombre,
    usuario: username,
    puntos: Number(jugador.puntos) || 0,
    aciertos: Number(jugador.aciertos) || 0,
    pronosticos: Number(jugador.pronosticos) || 0,
    exactos: Number(jugador.exactos) || 0,
    posicion: Number(jugador.posicion) || 0,
    avatar: nombre.trim().charAt(0).toUpperCase() || "H",
    esUsuarioActual: jugador.usuario_id === usuarioId,
  };
}

export async function obtenerRankingGlobalSupabase(usuarioId) {
  const { data, error } = await supabase.rpc("obtener_ranking_global");

  if (error) {
    throw error;
  }

  return (data || []).map((jugador) =>
    adaptarJugadorRankingSupabase(jugador, usuarioId)
  );
}

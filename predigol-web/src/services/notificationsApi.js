import { supabase } from "../lib/supabase.js";
import { obtenerPartidosExplorador } from "./footballApi.js";
import {
  adaptarPartidoNotificacion,
  construirAvisosPartidos,
  mapPronosticosByPartido,
} from "./notificationsMappers.js";

export async function obtenerNotificacionesPartidos(usuarioId, client = supabase) {
  const [partidos, respuestaPronosticos] = await Promise.all([
    obtenerPartidosExplorador({ limit: 80 }, client),
    client
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante")
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaPronosticos.error) throw respuestaPronosticos.error;

  return {
    partidos: partidos
      .filter((partido) => partido.es_relevante !== false)
      .map(adaptarPartidoNotificacion),
    pronosticos: mapPronosticosByPartido(respuestaPronosticos.data || []),
  };
}

export async function obtenerAvisosPartidosEnVivo(usuarioId, context, client = supabase) {
  const datos = await obtenerNotificacionesPartidos(usuarioId, client);
  return construirAvisosPartidos(
    datos.partidos,
    datos.pronosticos,
    context.ahora,
    context.preferences,
    context.favorites
  );
}

export async function obtenerNotificacionesUsuario(usuarioId, client = supabase) {
  return obtenerNotificacionesPartidos(usuarioId, client);
}

export function crearCanalRealtimeNotificaciones(client = supabase, onChange) {
  const canal = client
    .channel("predigol-notificaciones-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "partidos" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "football_fixtures" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "pronosticos" }, onChange)
    .subscribe();

  return {
    canal,
    cleanup: () => client.removeChannel(canal),
  };
}

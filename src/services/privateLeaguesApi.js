import {
  mapDetalleLiga,
  mapLigasPrivadas,
  mapRankingLiga,
  normalizarCodigoLiga,
} from "./privateLeaguesMappers.js";

const CARACTERES_CODIGO_LIGA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function obtenerClienteSupabase(client) {
  if (client) return client;
  const modulo = await import("../lib/supabase.js");
  return modulo.supabase;
}

export function generarCodigoLiga() {
  let codigo = "PREDI";
  const valoresAleatorios = new Uint32Array(5);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(valoresAleatorios);
  } else {
    for (let index = 0; index < valoresAleatorios.length; index += 1) {
      valoresAleatorios[index] = Math.floor(Math.random() * 100000);
    }
  }

  for (const valor of valoresAleatorios) {
    codigo += CARACTERES_CODIGO_LIGA[valor % CARACTERES_CODIGO_LIGA.length];
  }

  return codigo;
}

export function obtenerMensajeErrorLiga(error) {
  const mensaje = error?.message || "";

  if (/permission|policy|rls|not authorized|denied/i.test(mensaje)) {
    return "No tienes permisos para ver esta liga.";
  }

  return mensaje;
}

export async function obtenerLigasUsuario(usuarioId, client = null) {
  if (!usuarioId) return [];

  const db = await obtenerClienteSupabase(client);

  const { data, error } = await db.rpc("obtener_mis_ligas");

  if (error) throw error;

  return mapLigasPrivadas(data || [], usuarioId);
}

export async function crearLigaPrivada(
  { nombre, usuarioId },
  client = null,
  codeGenerator = generarCodigoLiga
) {
  const nombreNormalizado = String(nombre || "").trim();

  if (nombreNormalizado.length < 3) {
    throw new Error("El nombre de la liga debe tener al menos 3 caracteres.");
  }

  if (!usuarioId) {
    throw new Error("No encontramos tu sesión. Inicia sesión nuevamente.");
  }

  let ligaCreada = null;
  const db = await obtenerClienteSupabase(client);

  for (let intento = 0; intento < 5; intento += 1) {
    const codigo = codeGenerator();
    const { data, error } = await db
      .from("ligas")
      .insert({
        nombre: nombreNormalizado,
        codigo,
        creador_id: usuarioId,
      })
      .select("id, nombre, codigo")
      .single();

    if (!error) {
      ligaCreada = data;
      break;
    }

    if (error.code !== "23505") {
      throw error;
    }
  }

  if (!ligaCreada) {
    throw new Error("No fue posible generar un código único. Intenta nuevamente.");
  }

  const { error: errorMiembroCreador } = await db.from("liga_miembros").upsert(
    {
      liga_id: ligaCreada.id,
      usuario_id: usuarioId,
    },
    {
      onConflict: "liga_id,usuario_id",
      ignoreDuplicates: true,
    }
  );

  if (errorMiembroCreador) throw errorMiembroCreador;

  return mapLigasPrivadas([{ ...ligaCreada, participantes: 1, creador_id: usuarioId }], usuarioId)[0];
}

export async function unirseALigaPorCodigo(codigo, usuarioId, client = null) {
  const codigoNormalizado = normalizarCodigoLiga(codigo);

  if (!codigoNormalizado) {
    throw new Error("Ingresa el código de invitación.");
  }

  if (!usuarioId) {
    throw new Error("No encontramos tu sesión. Inicia sesión nuevamente.");
  }

  const db = await obtenerClienteSupabase(client);

  const { data: liga, error: errorLiga } = await db
    .from("ligas")
    .select("id, nombre, codigo")
    .eq("codigo", codigoNormalizado)
    .maybeSingle();

  if (errorLiga) throw errorLiga;

  if (!liga) {
    throw new Error("No encontramos una liga con ese código.");
  }

  const { error: errorUnion } = await db.from("liga_miembros").insert({
    liga_id: liga.id,
    usuario_id: usuarioId,
  });

  if (errorUnion?.code === "23505") {
    throw new Error("Ya haces parte de esta liga.");
  }

  if (errorUnion) throw errorUnion;

  return mapLigasPrivadas([{ ...liga, participantes: 1 }], usuarioId)[0];
}

export async function obtenerRankingLiga(ligaId, usuarioId = null, client = null) {
  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.rpc("obtener_ranking_liga", {
    p_liga_id: ligaId,
  });

  if (error) throw error;

  return mapRankingLiga(data || [], usuarioId);
}

export async function obtenerDetalleLiga(ligaId, usuarioId, client = null) {
  if (!ligaId || !usuarioId) {
    throw new Error("No tienes permisos para ver esta liga.");
  }

  const db = await obtenerClienteSupabase(client);

  const [respuestaDetalle, ranking] = await Promise.all([
    db.rpc("obtener_detalle_liga", {
      p_liga_id: ligaId,
    }),
    obtenerRankingLiga(ligaId, usuarioId, db),
  ]);

  if (respuestaDetalle.error) throw respuestaDetalle.error;

  const detalleLiga = respuestaDetalle.data?.[0];

  if (!detalleLiga) {
    throw new Error("No encontramos esta liga.");
  }

  return mapDetalleLiga(detalleLiga, ranking, usuarioId);
}

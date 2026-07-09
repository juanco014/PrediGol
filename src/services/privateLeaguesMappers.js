export function normalizarCodigoLiga(codigo) {
  return String(codigo || "").trim().toUpperCase();
}

export function mapLigaPrivada(liga = {}, usuarioId = null) {
  const ownerId = liga.creador_id ?? liga.ownerId ?? liga.owner_id ?? null;
  const totalMiembros = Number(
    liga.participantes ?? liga.totalMiembros ?? liga.total_miembros ?? 0
  );

  return {
    ...liga,
    id: liga.id,
    nombre: liga.nombre || "Liga privada",
    descripcion: liga.descripcion || "",
    codigo: liga.codigo ?? liga.codigoInvitacion ?? liga.codigo_invitacion ?? "",
    codigoInvitacion:
      liga.codigoInvitacion ?? liga.codigo_invitacion ?? liga.codigo ?? "",
    creador_id: ownerId,
    ownerId,
    participantes: Number.isFinite(totalMiembros) ? totalMiembros : 0,
    totalMiembros: Number.isFinite(totalMiembros) ? totalMiembros : 0,
    posicionUsuario: liga.posicionUsuario ?? liga.posicion_usuario ?? null,
    puntosUsuario: liga.puntosUsuario ?? liga.puntos_usuario ?? 0,
    createdAt: liga.createdAt ?? liga.created_at ?? null,
    esOwner: Boolean(usuarioId && ownerId && ownerId === usuarioId),
    esMiembro: liga.esMiembro ?? liga.es_miembro ?? true,
  };
}

export function mapLigasPrivadas(ligas = [], usuarioId = null) {
  return (ligas || []).map((liga) => mapLigaPrivada(liga, usuarioId));
}

export function mapJugadorRankingLiga(jugador = {}, usuarioId = null, index = 0) {
  const puntos = Number(jugador.puntos ?? 0);
  const aciertos = Number(jugador.aciertos ?? 0);

  return {
    ...jugador,
    usuario_id: jugador.usuario_id ?? jugador.usuarioId ?? jugador.id ?? null,
    usuarioId: jugador.usuarioId ?? jugador.usuario_id ?? jugador.id ?? null,
    nombre: jugador.nombre || "Jugador PrediGol",
    username: jugador.username || "",
    posicion: jugador.posicion ?? index + 1,
    puntos: Number.isFinite(puntos) ? puntos : 0,
    aciertos: Number.isFinite(aciertos) ? aciertos : 0,
    esUsuarioActual: Boolean(
      usuarioId && (jugador.usuario_id === usuarioId || jugador.usuarioId === usuarioId)
    ),
  };
}

export function mapRankingLiga(ranking = [], usuarioId = null) {
  return (ranking || []).map((jugador, index) =>
    mapJugadorRankingLiga(jugador, usuarioId, index)
  );
}

export function mapDetalleLiga(detalle = {}, ranking = [], usuarioId = null) {
  const liga = mapLigaPrivada(detalle, usuarioId);
  const rankingNormalizado = mapRankingLiga(ranking, usuarioId);
  const miembros = detalle.miembros || [];

  return {
    liga,
    detalle: liga,
    miembros,
    ranking: rankingNormalizado,
    pronosticos: [],
    invitacion: liga.codigoInvitacion
      ? {
          codigo: liga.codigoInvitacion,
        }
      : null,
    permisos: {
      esOwner: liga.esOwner,
      esMiembro: liga.esMiembro,
    },
  };
}

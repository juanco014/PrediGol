import jugadoresBase from "../data/jugadoresRanking";

export function crearUsuarioRanking({
  puntosTotales = 0,
  aciertos = 0,
  nombre = "Juan Sebastián",
  usuario = "@hincha_predigol",
  avatar = "J",
}) {
  return {
    id: "usuario-actual",
    nombre,
    usuario,
    puntos: Number(puntosTotales) || 0,
    aciertos: Number(aciertos) || 0,
    avatar,
    esUsuarioActual: true,
  };
}

export function obtenerRankingGlobal(usuarioActual) {
  const ranking = [
    ...jugadoresBase.filter((jugador) => jugador.id !== usuarioActual.id),
    usuarioActual,
  ]
    .map((jugador) => ({
      ...jugador,
      puntos: Number(jugador.puntos) || 0,
      aciertos: Number(jugador.aciertos) || 0,
    }))
    .sort((a, b) => {
      if (b.puntos !== a.puntos) {
        return b.puntos - a.puntos;
      }

      if (b.aciertos !== a.aciertos) {
        return b.aciertos - a.aciertos;
      }

      return a.nombre.localeCompare(b.nombre, "es");
    });

  const posicionUsuario =
    ranking.findIndex((jugador) => jugador.id === usuarioActual.id) + 1;

  const jugadorEncima = ranking[posicionUsuario - 2];

  const puntosParaSubir = jugadorEncima
    ? Math.max(1, jugadorEncima.puntos - usuarioActual.puntos + 1)
    : 0;

  const mensajePosicion = jugadorEncima
    ? `Te faltan ${puntosParaSubir} ${
        puntosParaSubir === 1 ? "punto" : "puntos"
      } para subir una posición.`
    : "Vas liderando el ranking global.";

  return {
    ranking,
    posicionUsuario,
    jugadorEncima,
    puntosParaSubir,
    mensajePosicion,
  };
}
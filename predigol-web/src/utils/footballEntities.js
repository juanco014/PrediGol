export function normalizarTextoBusqueda(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const formateadorFechaPartido = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function crearRutaEntidad(type, name) {
  const segment = type === "torneo" ? "torneos" : "equipos";
  return `/${segment}/${encodeURIComponent(name)}`;
}

export function leerNombreEntidad(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export function formatearFechaPartido(value) {
  if (!value) return "Sin fecha";

  return formateadorFechaPartido.format(new Date(value));
}

export function adaptarPartidoExplorador(partido) {
  const torneo = partido.torneo;
  const local = partido.local_nombre;
  const visitante = partido.visitante_nombre;
  const fechaOrden = partido.fecha_orden;

  return {
    id: partido.id,
    torneo,
    fechaOrden,
    fechaOrdenMs: fechaOrden ? new Date(fechaOrden).getTime() : 0,
    fechaTexto: partido.fecha_texto,
    local,
    visitante,
    localShort: partido.local_corto,
    visitanteShort: partido.visitante_corto,
    estado: partido.estado,
    minuto: partido.minuto,
    relevante: partido.es_relevante,
    golesLocal: partido.goles_local_final,
    golesVisitante: partido.goles_visitante_final,
    textoBusqueda: normalizarTextoBusqueda(`${local} ${visitante} ${torneo}`),
  };
}

export const PARTIDO_EXPLORADOR_SELECT = `
  id, torneo, fecha_texto, fecha_orden, local_nombre, visitante_nombre,
  local_corto, visitante_corto, estado, minuto, es_relevante,
  goles_local_final, goles_visitante_final
`;

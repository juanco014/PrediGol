import { adaptInternalMatchToPartidoRow, mapFootballFixtureToInternalMatch } from "./footballMappers.js";

export const ESTADO_ADMIN = {
  OK: "ok",
  WARNING: "warning",
  ERROR: "error",
  UNKNOWN: "unknown",
};

export const RESUMEN_ADMIN_VACIO = {
  totalPartidosLegacy: 0,
  totalFixtures: 0,
  fixturesVinculados: 0,
  fixturesSinVinculo: 0,
  partidosSinFixture: 0,
  equiposConLogo: 0,
  equiposSinLogo: 0,
  prediccionesDisponibles: 0,
  ultimoSync: null,
  erroresSync: 0,
  estadoGeneral: ESTADO_ADMIN.UNKNOWN,
};

function indexBy(items, key) {
  return new Map((items || []).map((item) => [item[key], item]));
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

export function adaptarFixtureAdmin(fixture, context = {}) {
  const match = mapFootballFixtureToInternalMatch(fixture, context);
  const row = adaptInternalMatchToPartidoRow(match);

  return {
    ...row,
    id: match.id || `fixture-${fixture.api_football_fixture_id}`,
    partido_id: match.id,
    adminReadOnly: !match.id,
    fixtureSinVinculo: !match.id,
    source: "football_fixtures",
    origen_datos: match.legacy?.origen_datos || "api_football",
    fuente_detalle: match.legacy?.fuente_detalle || "api-football",
    localLogoUrl: row.local_logo_url,
    visitanteLogoUrl: row.visitante_logo_url,
  };
}

export function adaptarPartidoAdmin(partido) {
  return {
    ...partido,
    partido_id: partido.id,
    adminReadOnly: false,
    fixtureSinVinculo: false,
    source: "partidos",
    localLogoUrl: partido.localLogoUrl || partido.local_logo_url || null,
    visitanteLogoUrl: partido.visitanteLogoUrl || partido.visitante_logo_url || null,
  };
}

export function construirListadoAdmin({ partidos = [], fixtures = [], teams = [], competitions = [] } = {}) {
  const partidosByFixtureId = indexBy(
    partidos.filter((partido) => hasValue(partido.api_football_fixture_id)),
    "api_football_fixture_id"
  );
  const teamsById = indexBy(teams, "api_football_team_id");
  const competitionsById = indexBy(competitions, "api_football_league_id");
  const fixtureRows = fixtures.map((fixture) =>
    adaptarFixtureAdmin(fixture, { teamsById, competitionsById, partidosByFixtureId })
  );
  const fixtureIds = new Set(fixtures.map((fixture) => fixture.api_football_fixture_id));
  const partidosSinFixtureSincronizado = partidos
    .filter((partido) => !fixtureIds.has(partido.api_football_fixture_id))
    .map(adaptarPartidoAdmin);

  return [...fixtureRows, ...partidosSinFixtureSincronizado].sort(
    (a, b) => new Date(b.fecha_orden || 0).getTime() - new Date(a.fecha_orden || 0).getTime()
  );
}

export function construirResumenAdminPartidos({
  partidos = [],
  fixtures = [],
  teams = [],
  predictions = [],
  syncRuns = [],
  errores = {},
} = {}) {
  const fixtureIdsLegacy = new Set(
    partidos
      .map((partido) => partido.api_football_fixture_id)
      .filter((fixtureId) => fixtureId !== null && fixtureId !== undefined)
  );
  const fixturesVinculados = fixtures.filter((fixture) =>
    fixtureIdsLegacy.has(fixture.api_football_fixture_id)
  ).length;
  const equiposConLogo = teams.filter((team) => Boolean(team.logo_url)).length;
  const equiposSinLogo = teams.filter((team) => !team.logo_url).length;
  const erroresSync = syncRuns.filter(
    (run) => run.status === "error" || Boolean(run.error_message)
  ).length;
  const tieneErroresConsulta = Object.values(errores).some(Boolean);
  const hayDatos = partidos.length > 0 || fixtures.length > 0;
  const estadoGeneral = tieneErroresConsulta
    ? ESTADO_ADMIN.ERROR
    : !hayDatos
      ? ESTADO_ADMIN.UNKNOWN
      : fixtures.length > fixturesVinculados || equiposSinLogo > 0
        ? ESTADO_ADMIN.WARNING
        : ESTADO_ADMIN.OK;

  return {
    ...RESUMEN_ADMIN_VACIO,
    totalPartidosLegacy: partidos.length,
    totalFixtures: fixtures.length,
    fixturesVinculados,
    fixturesSinVinculo: Math.max(fixtures.length - fixturesVinculados, 0),
    partidosSinFixture: partidos.filter((partido) => !partido.api_football_fixture_id).length,
    equiposConLogo,
    equiposSinLogo,
    prediccionesDisponibles: predictions.length,
    ultimoSync: syncRuns[0] ?? null,
    erroresSync,
    estadoGeneral,
    errores,
  };
}

export function construirCalidadDatosPartidos(resumen = RESUMEN_ADMIN_VACIO) {
  const detalles = [];

  if (resumen.totalPartidosLegacy === 0 && resumen.totalFixtures === 0) {
    return {
      nivel: ESTADO_ADMIN.UNKNOWN,
      mensaje: "No hay partidos cargados todavía.",
      total: 0,
      detalles,
    };
  }

  if (resumen.totalFixtures === 0) {
    detalles.push("No hay fixtures sincronizados.");
  }

  if (resumen.fixturesSinVinculo > 0) {
      detalles.push(`${resumen.fixturesSinVinculo} fixtures sin vínculo legacy.`);
  }

  if (resumen.partidosSinFixture > 0) {
    detalles.push(`${resumen.partidosSinFixture} partidos legacy sin fixture.`);
  }

  if (resumen.equiposSinLogo > 0) {
    detalles.push(`${resumen.equiposSinLogo} equipos sin logo.`);
  }

  if (resumen.erroresSync > 0) {
    detalles.push(`${resumen.erroresSync} sincronizaciones con error.`);
  }

  const nivel = resumen.estadoGeneral;
  const mensaje = nivel === ESTADO_ADMIN.OK
    ? "Datos admin completos."
    : nivel === ESTADO_ADMIN.ERROR
      ? "No se pudo cargar el resumen admin."
      : "Datos incompletos: revisar equipos, logos o vínculos.";

  return {
    nivel,
    mensaje,
    total: resumen.totalPartidosLegacy + resumen.totalFixtures,
    detalles,
  };
}

export function construirResumenMvp({ partidos = [], predictions = [], evaluations = [], clientErrors = [], errores = {} } = {}) {
  const fixturesConPrediccion = new Set(
    predictions
      .map((prediccion) => prediccion.api_football_fixture_id)
      .filter((fixtureId) => fixtureId !== null && fixtureId !== undefined)
  );
  const historicosEntrenables = partidos.filter(
    (partido) =>
      partido.estado === "finalizado" &&
      partido.goles_local_final !== null &&
      partido.goles_visitante_final !== null
  ).length;
  const proximosRelevantesLista = partidos.filter(
    (partido) =>
      partido.estado === "proximo" &&
      partido.es_relevante &&
      partido.api_football_fixture_id !== null
  );
  const proximosRelevantes = proximosRelevantesLista.length;
  const proximosConPrediccion = proximosRelevantesLista.filter((partido) =>
    fixturesConPrediccion.has(partido.api_football_fixture_id)
  ).length;
  const hace24Horas = Date.now() - 24 * 60 * 60 * 1000;
  const confianzaPromedio = predictions.length > 0
    ? predictions.reduce((total, prediccion) => total + Number(prediccion.confidence || 0), 0) /
      predictions.length
    : 0;

  return {
    total: partidos.length,
    finalizados: partidos.filter((partido) => partido.estado === "finalizado").length,
    historicosEntrenables,
    proximosRelevantes,
    apiFootball: partidos.filter((partido) => partido.origen_datos === "api_football").length,
    googleSheets: partidos.filter((partido) => partido.origen_datos === "google_sheets").length,
    manuales: partidos.filter((partido) => !partido.origen_datos || partido.origen_datos === "manual").length,
    prediccionesGuardadas: predictions.length,
    prediccionesPorModelo: predictions.reduce((conteo, prediccion) => {
      const version = prediccion.model_version || "sin version";
      conteo[version] = (conteo[version] || 0) + 1;
      return conteo;
    }, {}),
    proximosConPrediccion,
    faltanPredicciones: Math.max(proximosRelevantes - proximosConPrediccion, 0),
    ultimaPrediccion: predictions[0]?.generated_at ?? null,
    confianzaPromedio,
    prediccionesError: errores.predictions ?? null,
    ultimaEvaluacion: evaluations[0] ?? null,
    evaluaciones: evaluations,
    evaluacionError: errores.evaluations ?? null,
    erroresCliente24h: clientErrors.filter(
      (errorCliente) => new Date(errorCliente.created_at).getTime() >= hace24Horas
    ).length,
    ultimoErrorCliente: clientErrors[0] ?? null,
    erroresClienteError: errores.clientErrors ?? null,
  };
}

export function normalizarEstadoSincronizacionFootball(monitor) {
  const runs = monitor?.runs || [];
  const ultimoSync = runs[0] ?? null;

  return {
    config: monitor?.config ?? {},
    summary: monitor?.summary ?? {},
    runs,
    ultimoSync,
    nivel: monitor?.error
      ? ESTADO_ADMIN.ERROR
      : runs.length === 0
        ? ESTADO_ADMIN.UNKNOWN
        : ultimoSync?.status === "error"
          ? ESTADO_ADMIN.ERROR
          : ultimoSync?.status === "partial"
            ? ESTADO_ADMIN.WARNING
            : ESTADO_ADMIN.OK,
    mensaje: monitor?.error || (runs.length === 0 ? "No hay registros de sincronización." : null),
  };
}

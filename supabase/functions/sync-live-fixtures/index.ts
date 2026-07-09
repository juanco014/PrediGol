import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL =
  Deno.env.get("API_FOOTBALL_BASE_URL") ?? "https://v3.football.api-sports.io";
const API_KEY = Deno.env.get("API_FOOTBALL_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const CANCELLED_STATUSES = new Set(["PST", "CANC", "ABD", "AWD", "WO"]);

type ApiFootballQuota = {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
};

function parseRateLimitHeader(value: string | null) {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function readApiFootballQuota(headers: Headers): ApiFootballQuota {
  return {
    dailyLimit: parseRateLimitHeader(headers.get("x-ratelimit-requests-limit")),
    dailyRemaining: parseRateLimitHeader(headers.get("x-ratelimit-requests-remaining")),
    minuteLimit: parseRateLimitHeader(headers.get("x-ratelimit-limit")),
    minuteRemaining: parseRateLimitHeader(headers.get("x-ratelimit-remaining")),
  };
}

function getSupabaseAdminKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    const parsedKeys = JSON.parse(secretKeys);
    return parsedKeys.default ?? Object.values(parsedKeys)[0] ?? null;
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function assertEnvironment() {
  const missing = [];

  if (!API_KEY) missing.push("API_FOOTBALL_KEY");
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!getSupabaseAdminKey()) {
    missing.push("SUPABASE_SECRET_KEYS");
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function mapFixtureStatus(statusShort: string | null | undefined) {
  if (!statusShort || statusShort === "NS" || statusShort === "TBD") {
    return "proximo";
  }

  if (LIVE_STATUSES.has(statusShort)) {
    return "en_vivo";
  }

  if (FINISHED_STATUSES.has(statusShort)) {
    return "finalizado";
  }

  if (CANCELLED_STATUSES.has(statusShort)) {
    return "cancelado";
  }

  return "proximo";
}

function getShortName(name: string | null | undefined) {
  if (!name) return "TBD";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return initials || name.slice(0, 3).toUpperCase();
}

function getDateLabel(fixture: any) {
  const status = mapFixtureStatus(fixture.fixture?.status?.short);

  if (status === "en_vivo") return "En vivo";
  if (status === "finalizado") return "Finalizado";
  if (status === "cancelado") return "Cancelado";

  const date = fixture.fixture?.date;

  if (!date) return "Por definir";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(date));
}

function toTeamRow(team: any) {
  return {
    api_football_team_id: team?.team?.id,
    name: team?.team?.name,
    code: team?.team?.code ?? null,
    country: team?.team?.country ?? null,
    logo_url: team?.team?.logo ?? null,
    founded: team?.team?.founded ?? null,
    national: team?.team?.national ?? null,
    raw_payload: team?.team ?? {},
    updated_at: new Date().toISOString(),
  };
}

function toFixtureRow(fixture: any) {
  const apiFixtureId = fixture.fixture?.id;
  const statusShort = fixture.fixture?.status?.short ?? "NS";

  return {
    api_football_fixture_id: apiFixtureId,
    competition_api_id: fixture.league?.id ?? null,
    season_start_year: fixture.league?.season ?? null,
    round: fixture.league?.round ?? null,
    kickoff_at: fixture.fixture?.date,
    timezone: fixture.fixture?.timezone ?? null,
    status: mapFixtureStatus(statusShort),
    status_short: statusShort,
    elapsed: fixture.fixture?.status?.elapsed ?? null,
    venue_id: fixture.fixture?.venue?.id ?? null,
    venue_name: fixture.fixture?.venue?.name ?? null,
    venue_city: fixture.fixture?.venue?.city ?? null,
    home_team_api_id: fixture.teams?.home?.id ?? null,
    away_team_api_id: fixture.teams?.away?.id ?? null,
    goals_home: fixture.goals?.home ?? null,
    goals_away: fixture.goals?.away ?? null,
    score_halftime_home: fixture.score?.halftime?.home ?? null,
    score_halftime_away: fixture.score?.halftime?.away ?? null,
    score_fulltime_home: fixture.score?.fulltime?.home ?? null,
    score_fulltime_away: fixture.score?.fulltime?.away ?? null,
    raw_payload: fixture,
    updated_at: new Date().toISOString(),
  };
}

function toPartidoRow(fixture: any) {
  const estado = mapFixtureStatus(fixture.fixture?.status?.short);
  const isFinished = estado === "finalizado";

  return {
    id: fixture.fixture?.id,
    api_football_fixture_id: fixture.fixture?.id,
    api_football_league_id: fixture.league?.id ?? null,
    temporada: fixture.league?.season ?? null,
    ronda: fixture.league?.round ?? null,
    torneo: fixture.league?.name ?? "Futbol",
    fecha_texto: getDateLabel(fixture),
    fecha_orden: fixture.fixture?.date,
    local_nombre: fixture.teams?.home?.name ?? "Local",
    visitante_nombre: fixture.teams?.away?.name ?? "Visitante",
    local_corto: getShortName(fixture.teams?.home?.name),
    visitante_corto: getShortName(fixture.teams?.away?.name),
    estado,
    goles_local_final: isFinished ? fixture.goals?.home ?? null : null,
    goles_visitante_final: isFinished ? fixture.goals?.away ?? null : null,
    minuto: fixture.fixture?.status?.elapsed ?? null,
    payload_api: fixture,
    actualizado_api_en: new Date().toISOString(),
    origen_datos: "api_football",
    fuente_detalle: "api-football",
    creado_manual_en: null,
  };
}

function toLiveSnapshotRow(fixture: any) {
  return {
    api_football_fixture_id: fixture.fixture?.id,
    status: mapFixtureStatus(fixture.fixture?.status?.short),
    status_short: fixture.fixture?.status?.short ?? "LIVE",
    elapsed: fixture.fixture?.status?.elapsed ?? null,
    goals_home: fixture.goals?.home ?? null,
    goals_away: fixture.goals?.away ?? null,
    raw_payload: fixture,
  };
}

async function fetchApiFootball(
  path: string,
  params: Record<string, string | number>,
  onQuota?: (quota: ApiFootballQuota) => void,
) {
  const url = new URL(`${API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY ?? "",
    },
    signal: AbortSignal.timeout(20000),
  });

  onQuota?.(readApiFootballQuota(response.headers));

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`API-Football returned ${response.status}: ${JSON.stringify(payload)}`);
  }

  const apiErrors = payload?.errors ?? {};

  if (Object.keys(apiErrors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(apiErrors)}`);
  }

  return payload?.response ?? [];
}

function isApiFootballError(error: unknown) {
  return error instanceof Error && error.message.startsWith("API-Football");
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function authorizeSyncRequest(request: Request, supabase: any) {
  const { data: config, error: configError } = await supabase
    .from("predigol_api_football_sync_config")
    .select("sync_secret")
    .eq("id", "default")
    .maybeSingle();

  if (configError) {
    throw configError;
  }

  const providedSecret = request.headers.get("x-sync-secret");

  if (providedSecret && config?.sync_secret && providedSecret === config.sync_secret) {
    return "pg_cron";
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    throw new Error("Unauthorized: admin session or cron secret required.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new Error("Unauthorized: invalid admin session.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("rol, es_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.rol !== "admin" && profile?.es_admin !== true) {
    throw new Error("Unauthorized: admin role required.");
  }

  return "manual";
}

async function loadCompetitions(supabase: any) {
  const { data, error } = await supabase
    .from("football_competitions")
    .select("api_football_league_id, season_start_year, enabled")
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string | number | null | undefined) {
  const map = new Map<string | number, T>();

  for (const item of items) {
    const key = getKey(item);

    if (key !== null && key !== undefined) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

async function upsertFixtures(supabase: any, fixtures: any[], storeLiveSnapshots: boolean) {
  const filteredFixtures = fixtures.filter((fixture) => fixture.fixture?.id);

  if (filteredFixtures.length === 0) {
    return {
      fixtures: 0,
      teams: 0,
      partidos: 0,
      liveSnapshots: 0,
    };
  }

  const teamRows = uniqueBy(
    filteredFixtures.flatMap((fixture) => [
      { team: fixture.teams?.home },
      { team: fixture.teams?.away },
    ]),
    (row) => row.team?.id,
  )
    .filter((row) => row.team?.id && row.team?.name)
    .map(toTeamRow);

  if (teamRows.length > 0) {
    const { error } = await supabase
      .from("football_teams")
      .upsert(teamRows, { onConflict: "api_football_team_id" });

    if (error) throw error;
  }

  const fixtureRows = filteredFixtures.map(toFixtureRow);
  const { error: fixturesError } = await supabase
    .from("football_fixtures")
    .upsert(fixtureRows, { onConflict: "api_football_fixture_id" });

  if (fixturesError) throw fixturesError;

  const partidoRows = filteredFixtures.map(toPartidoRow);
  const { error: partidosError } = await supabase
    .from("partidos")
    .upsert(partidoRows, { onConflict: "api_football_fixture_id" });

  if (partidosError) throw partidosError;

  let liveSnapshots = 0;

  if (storeLiveSnapshots) {
    const liveRows = filteredFixtures
      .filter((fixture) => mapFixtureStatus(fixture.fixture?.status?.short) === "en_vivo")
      .map(toLiveSnapshotRow);

    if (liveRows.length > 0) {
      const { error: snapshotsError } = await supabase
        .from("football_live_snapshots")
        .insert(liveRows);

      if (snapshotsError) throw snapshotsError;

      liveSnapshots = liveRows.length;
    }
  }

  return {
    fixtures: fixtureRows.length,
    teams: teamRows.length,
    partidos: partidoRows.length,
    liveSnapshots,
  };
}

function parseLimit(url: URL) {
  const limit = Number(url.searchParams.get("limit") ?? 15);

  if (!Number.isFinite(limit)) return 15;

  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function parseSeasonOverride(url: URL) {
  const season = Number(url.searchParams.get("season"));

  if (!Number.isInteger(season)) {
    return null;
  }

  return season;
}

function parseDateRange(url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (from && to) {
    return { from, to };
  }

  const season = parseSeasonOverride(url);

  if (!season) {
    return null;
  }

  return {
    from: `${season}-01-01`,
    to: `${season}-12-31`,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let syncRunId: number | null = null;
  let syncSupabase: any = null;

  try {
    assertEnvironment();

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "live";
    const supportedModes = new Set(["live", "upcoming", "results", "range", "all"]);

    if (!supportedModes.has(mode)) {
      throw new Error(`Unsupported sync mode: ${mode}.`);
    }

    const limit = parseLimit(url);
    const seasonOverride = parseSeasonOverride(url);
    const dateRange = parseDateRange(url);
    const supabaseAdminKey = getSupabaseAdminKey();
    const supabase = createClient(SUPABASE_URL!, supabaseAdminKey!, {
      auth: {
        persistSession: false,
      },
    });
    syncSupabase = supabase;
    const triggerSource = await authorizeSyncRequest(request, supabase);

    const { data: syncRun, error: syncRunError } = await supabase
      .from("api_football_sync_runs")
      .insert({
        trigger_source: triggerSource,
        mode,
        season: seasonOverride,
        date_from: dateRange?.from ?? null,
        date_to: dateRange?.to ?? null,
        request_limit: limit,
      })
      .select("id")
      .maybeSingle();

    if (syncRunError) {
      console.warn("Could not create API-Football sync run:", syncRunError.message);
    } else {
      syncRunId = syncRun?.id ?? null;
    }

    const competitions = await loadCompetitions(supabase);
    const enabledLeagueIds = new Set(
      competitions.map((competition: any) => Number(competition.api_football_league_id)),
    );

    const totals = {
      requests: 0,
      fixtures: 0,
      teams: 0,
      partidos: 0,
      liveSnapshots: 0,
      skipped: [] as string[],
    };

    let quota: ApiFootballQuota = {
      dailyLimit: null,
      dailyRemaining: null,
      minuteLimit: null,
      minuteRemaining: null,
    };

    const captureQuota = (nextQuota: ApiFootballQuota) => {
      quota = {
        dailyLimit: nextQuota.dailyLimit ?? quota.dailyLimit,
        dailyRemaining: nextQuota.dailyRemaining ?? quota.dailyRemaining,
        minuteLimit: nextQuota.minuteLimit ?? quota.minuteLimit,
        minuteRemaining: nextQuota.minuteRemaining ?? quota.minuteRemaining,
      };
    };

    const fetchTracked = async (
      path: string,
      params: Record<string, string | number>,
    ) => {
      totals.requests += 1;
      return await fetchApiFootball(path, params, captureQuota);
    };

    if (mode === "live" || mode === "all") {
      const liveFixtures = await fetchTracked("/fixtures", { live: "all" });

      const relevantLiveFixtures = liveFixtures.filter((fixture: any) =>
        enabledLeagueIds.has(Number(fixture.league?.id))
      );

      const summary = await upsertFixtures(supabase, relevantLiveFixtures, true);
      totals.fixtures += summary.fixtures;
      totals.teams += summary.teams;
      totals.partidos += summary.partidos;
      totals.liveSnapshots += summary.liveSnapshots;
    }

    if (mode === "upcoming" || mode === "all") {
      for (const competition of competitions) {
        let fixtures = [];

        try {
          fixtures = await fetchTracked("/fixtures", {
            league: competition.api_football_league_id,
            season: seasonOverride ?? competition.season_start_year,
            next: limit,
          });
        } catch (error) {
          if (!isApiFootballError(error)) {
            throw error;
          }

          totals.skipped.push(
            `${competition.api_football_league_id}: ${errorToMessage(error)}`,
          );
          continue;
        }

        const summary = await upsertFixtures(supabase, fixtures, false);
        totals.fixtures += summary.fixtures;
        totals.teams += summary.teams;
        totals.partidos += summary.partidos;
      }
    }

    if (mode === "results" || mode === "all") {
      for (const competition of competitions) {
        let fixtures = [];

        try {
          const resultsParams = dateRange
            ? {
                league: competition.api_football_league_id,
                season: seasonOverride ?? competition.season_start_year,
                from: dateRange.from,
                to: dateRange.to,
              }
            : {
                league: competition.api_football_league_id,
                season: competition.season_start_year,
                last: limit,
              };

          fixtures = await fetchTracked("/fixtures", resultsParams);
        } catch (error) {
          if (!isApiFootballError(error)) {
            throw error;
          }

          totals.skipped.push(
            `${competition.api_football_league_id}: ${errorToMessage(error)}`,
          );
          continue;
        }

        const finishedFixtures = fixtures.filter((fixture: any) =>
          FINISHED_STATUSES.has(fixture.fixture?.status?.short ?? "")
        );

        const summary = await upsertFixtures(supabase, finishedFixtures, false);
        totals.fixtures += summary.fixtures;
        totals.teams += summary.teams;
        totals.partidos += summary.partidos;
      }
    }

    if (mode === "range") {
      if (!dateRange || !seasonOverride) {
        throw new Error("mode=range requires season, from and to query parameters.");
      }

      for (const competition of competitions) {
        let fixtures = [];

        try {
          fixtures = await fetchTracked("/fixtures", {
            league: competition.api_football_league_id,
            season: seasonOverride,
            from: dateRange.from,
            to: dateRange.to,
          });
        } catch (error) {
          if (!isApiFootballError(error)) {
            throw error;
          }

          totals.skipped.push(
            `${competition.api_football_league_id}: ${errorToMessage(error)}`,
          );
          continue;
        }

        const summary = await upsertFixtures(supabase, fixtures, false);
        totals.fixtures += summary.fixtures;
        totals.teams += summary.teams;
        totals.partidos += summary.partidos;
      }
    }

    const responsePayload = {
      ok: true,
      mode,
      limit,
      seasonOverride,
      dateRange,
      competitions: competitions.length,
      quota,
      ...totals,
    };

    if (syncRunId !== null) {
      const { error: finishRunError } = await supabase
        .from("api_football_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          status: totals.skipped.length > 0 ? "partial" : "success",
          requests_count: totals.requests,
          fixtures_count: totals.fixtures,
          teams_count: totals.teams,
          partidos_count: totals.partidos,
          live_snapshots_count: totals.liveSnapshots,
          skipped_count: totals.skipped.length,
          daily_limit: quota.dailyLimit,
          daily_remaining: quota.dailyRemaining,
          minute_limit: quota.minuteLimit,
          minute_remaining: quota.minuteRemaining,
          result: responsePayload,
        })
        .eq("id", syncRunId);

      if (finishRunError) {
        console.warn("Could not finish API-Football sync run:", finishRunError.message);
      }
    }

    return new Response(
      JSON.stringify(responsePayload),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const errorMessage = errorToMessage(error);

    if (syncSupabase && syncRunId !== null) {
      const { error: failRunError } = await syncSupabase
        .from("api_football_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          status: "error",
          error_message: errorMessage,
          result: {
            ok: false,
            error: errorMessage,
          },
        })
        .eq("id", syncRunId);

      if (failRunError) {
        console.warn("Could not fail API-Football sync run:", failRunError.message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
      }),
      {
        status: errorMessage.startsWith("Unauthorized:") ? 401 : 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

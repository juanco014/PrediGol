import { TEAM_LOGOS } from "../data/teamLogos.js";
import { AMBIGUOUS_TEAM_ALIASES, TEAM_ALIASES } from "./teamAliases.js";

export const MATCH_STATUS = {
  UPCOMING: "proximo",
  LIVE: "en_vivo",
  FINISHED: "finalizado",
  CANCELLED: "cancelado",
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "FINALIZADO", "FINISHED"]);
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE", "EN_VIVO"]);
const CANCELLED_STATUSES = new Set(["PST", "CANC", "ABD", "AWD", "WO", "CANCELADO"]);

export function normalizeTeamName(value) {
  return normalizeTextKey(value);
}

export function normalizeTextKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.&,+()[\]{}'`´’\-_/]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTeamAlias(value, aliases = TEAM_ALIASES) {
  const key = normalizeTextKey(value);

  if (!key || AMBIGUOUS_TEAM_ALIASES.has(key)) {
    return key;
  }

  return aliases[key] || key;
}

export function getCanonicalTeamKey(teamName, aliases = TEAM_ALIASES) {
  return normalizeTeamAlias(teamName, aliases);
}

export function normalizeTeamCode(value, fallbackName = "") {
  const explicitCode = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();

  if (explicitCode) {
    return explicitCode;
  }

  return String(fallbackName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function normalizeMatchStatus(value) {
  const status = String(value || "")
    .trim()
    .toUpperCase();

  if (FINISHED_STATUSES.has(status)) return MATCH_STATUS.FINISHED;
  if (LIVE_STATUSES.has(status)) return MATCH_STATUS.LIVE;
  if (CANCELLED_STATUSES.has(status)) return MATCH_STATUS.CANCELLED;
  if (["FINALIZADO", "EN_VIVO", "CANCELADO", "PROXIMO"].includes(status)) {
    return status.toLowerCase() === "en_vivo" ? MATCH_STATUS.LIVE : status.toLowerCase();
  }

  return MATCH_STATUS.UPCOMING;
}

export function normalizeKickoffAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getTeamDisplayName(team) {
  return String(team?.name || team?.short_name || team?.code || "Equipo").trim();
}

export function getTeamLogoUrl(team) {
  return typeof team?.logo_url === "string" && team.logo_url.trim()
    ? team.logo_url.trim()
    : null;
}

function mapGetByCanonicalKey(teamName, logoMap) {
  const canonicalKey = getCanonicalTeamKey(teamName);

  if (!canonicalKey || !logoMap) {
    return null;
  }

  if (logoMap instanceof Map) {
    return logoMap.get(canonicalKey) || null;
  }

  for (const [teamKey, logoUrl] of Object.entries(logoMap)) {
    if (getCanonicalTeamKey(teamKey) === canonicalKey) {
      return logoUrl || null;
    }
  }

  return null;
}

export function resolveTeamLogo(teamName, logosMap, fallbackMap = TEAM_LOGOS, directLogoUrl = null) {
  if (typeof directLogoUrl === "string" && directLogoUrl.trim()) {
    return directLogoUrl.trim();
  }

  const exactKey = normalizeTextKey(teamName);

  if (!exactKey) {
    return null;
  }

  if (logosMap instanceof Map && logosMap.get(exactKey)) {
    return logosMap.get(exactKey);
  }

  if (logosMap && !(logosMap instanceof Map)) {
    for (const [teamKey, logoUrl] of Object.entries(logosMap)) {
      if (normalizeTextKey(teamKey) === exactKey) {
        return logoUrl || null;
      }
    }
  }

  return mapGetByCanonicalKey(teamName, logosMap) || mapGetByCanonicalKey(teamName, fallbackMap);
}

export function mapExternalMatchToInternal(match) {
  const fixture = match?.fixture || {};
  const league = match?.league || {};
  const teams = match?.teams || {};
  const goals = match?.goals || {};
  const homeTeam = teams.home || {};
  const awayTeam = teams.away || {};
  const statusShort = fixture.status?.short || match?.status;
  const status = normalizeMatchStatus(statusShort);

  return {
    external_id: fixture.id ?? match?.external_id ?? null,
    league_external_id: league.id ?? match?.league_external_id ?? null,
    league_name: league.name ?? match?.league_name ?? "",
    season_year: league.season ?? match?.season_year ?? null,
    round: league.round ?? match?.round ?? "",
    kickoff_at: normalizeKickoffAt(fixture.date ?? match?.kickoff_at),
    status,
    home_team: {
      external_id: homeTeam.id ?? match?.home_team?.external_id ?? null,
      name: homeTeam.name ?? match?.home_team?.name ?? "",
      logo_url: getTeamLogoUrl(homeTeam),
    },
    away_team: {
      external_id: awayTeam.id ?? match?.away_team?.external_id ?? null,
      name: awayTeam.name ?? match?.away_team?.name ?? "",
      logo_url: getTeamLogoUrl(awayTeam),
    },
    home_score: status === MATCH_STATUS.FINISHED ? goals.home ?? null : null,
    away_score: status === MATCH_STATUS.FINISHED ? goals.away ?? null : null,
    source: match?.source || "api-football",
    raw: match || {},
  };
}

export function adaptPartidoRow(partido) {
  return {
    ...partido,
    localLogoUrl: partido.local_logo_url || null,
    visitanteLogoUrl: partido.visitante_logo_url || null,
  };
}

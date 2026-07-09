import { TEAM_LOGOS } from "../data/teamLogos.js";

export function normalizeTeamLogoKey(teamName) {
  return String(teamName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.&,+()[\]{}'`´’\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTeamLogo(teamName, logoMap = TEAM_LOGOS) {
  const normalizedTeam = normalizeTeamLogoKey(teamName);

  if (!normalizedTeam) {
    return null;
  }

  for (const [teamKey, logoUrl] of Object.entries(logoMap || {})) {
    if (normalizeTeamLogoKey(teamKey) === normalizedTeam) {
      return logoUrl || null;
    }
  }

  return null;
}

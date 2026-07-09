from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class ImportedMatch:
    external_id: str
    tournament: str
    kickoff_at: str
    home_team: str
    away_team: str
    status: str
    home_goals: int | None = None
    away_goals: int | None = None
    season: int | None = None
    round_name: str | None = None

    def to_partidos_payload(self) -> dict[str, Any]:
        return {
            "external_id": self.external_id,
            "torneo": self.tournament,
            "fecha_orden": self.kickoff_at,
            "local_nombre": self.home_team,
            "visitante_nombre": self.away_team,
            "estado": self.status,
            "goles_local_final": self.home_goals,
            "goles_visitante_final": self.away_goals,
            "temporada": self.season,
            "ronda": self.round_name,
        }


class MatchImporter(Protocol):
    def fetch_matches(self, season: int, tournament: str | None = None) -> list[ImportedMatch]:
        """Return normalized matches from an external provider."""


def normalize_imported_match(raw: dict[str, Any]) -> ImportedMatch:
    required = ["external_id", "tournament", "kickoff_at", "home_team", "away_team", "status"]
    missing = [field for field in required if not raw.get(field)]
    if missing:
        raise ValueError(f"Faltan campos requeridos para importar partido: {', '.join(missing)}")

    datetime.fromisoformat(str(raw["kickoff_at"]).replace("Z", "+00:00"))

    return ImportedMatch(
        external_id=str(raw["external_id"]),
        tournament=str(raw["tournament"]),
        kickoff_at=str(raw["kickoff_at"]),
        home_team=str(raw["home_team"]),
        away_team=str(raw["away_team"]),
        status=str(raw["status"]),
        home_goals=raw.get("home_goals"),
        away_goals=raw.get("away_goals"),
        season=raw.get("season"),
        round_name=raw.get("round_name"),
    )

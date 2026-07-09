from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

NORMALIZATION_VERSION = "team-normalization-v1"

COMMON_PARTICLES = {
    "fc",
    "cf",
    "cd",
    "club",
    "deportivo",
    "deportes",
    "sa",
    "s a",
    "s.a",
    "s.a.",
}

ABBREVIATIONS = {
    "atl": "atletico",
    "atlet": "atletico",
    "dep": "deportivo",
    "depor": "deportivo",
    "univ": "universidad",
    "u": "universidad",
    "america fc": "america",
}


@dataclass(frozen=True)
class TeamAlias:
    canonical_name: str
    alias: str
    tournament: str | None = None
    country: str | None = None
    active: bool = True
    status: str = "approved"
    confidence: float = 1.0
    source: str = "manual"
    notes: str | None = None

    @property
    def canonical_key(self) -> str:
        return normalize_team_key(self.canonical_name)

    @property
    def alias_key(self) -> str:
        return normalize_team_key(self.alias)


@dataclass(frozen=True)
class NormalizationResult:
    original_name: str
    normalized_key: str
    canonical_name: str
    canonical_key: str
    status: str
    confidence: float
    warnings: tuple[str, ...] = ()


def strip_accents(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", value) if unicodedata.category(char) != "Mn"
    )


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_team_key(name: str | None) -> str:
    value = strip_accents(str(name or "").casefold())
    value = re.sub(r"[.&,+()\[\]{}'`´’]", " ", value)
    value = re.sub(r"[-_/]", " ", value)
    value = normalize_spaces(value)

    for source, target in ABBREVIATIONS.items():
        value = re.sub(rf"\b{re.escape(source)}\b", target, value)

    tokens = [token for token in value.split(" ") if token and token not in COMMON_PARTICLES]
    return normalize_spaces(" ".join(tokens))


def display_canonical_name(name: str | None) -> str:
    return normalize_spaces(str(name or ""))


class TeamNormalizer:
    def __init__(self, aliases: list[TeamAlias] | None = None) -> None:
        self.aliases = [alias for alias in aliases or [] if alias.active]
        self.alias_index: dict[tuple[str, str, str], list[TeamAlias]] = {}
        for alias in self.aliases:
            key = (
                alias.alias_key,
                (alias.tournament or "").casefold(),
                (alias.country or "").casefold(),
            )
            self.alias_index.setdefault(key, []).append(alias)

    @classmethod
    def from_supabase_rows(cls, rows: list[dict[str, Any]]) -> "TeamNormalizer":
        return cls(
            [
                TeamAlias(
                    canonical_name=row.get("canonical_name") or row.get("alias") or "",
                    alias=row.get("alias") or row.get("canonical_name") or "",
                    tournament=row.get("tournament"),
                    country=row.get("country"),
                    active=bool(row.get("active", True)),
                    status=row.get("status") or "pending_review",
                    confidence=float(row.get("confidence") or 0.5),
                    source=row.get("source") or "supabase",
                    notes=row.get("notes"),
                )
                for row in rows
            ]
        )

    def resolve(self, name: str | None, tournament: str | None = None, country: str | None = None) -> NormalizationResult:
        original = display_canonical_name(name)
        normalized_key = normalize_team_key(original)
        if not normalized_key:
            return NormalizationResult(original, "", original, "", "invalid", 0.0, ("Nombre de equipo vacio.",))

        candidates = self._candidates(normalized_key, tournament, country)
        approved = [alias for alias in candidates if alias.status == "approved"]
        pending = [alias for alias in candidates if alias.status == "pending_review"]

        if len(approved) == 1:
            alias = approved[0]
            return NormalizationResult(
                original,
                normalized_key,
                alias.canonical_name,
                alias.canonical_key,
                "approved",
                alias.confidence,
            )

        if len(approved) > 1:
            return NormalizationResult(
                original,
                normalized_key,
                original,
                normalized_key,
                "pending_review",
                0.0,
                ("Alias aprobado apunta a mas de un equipo canonico.",),
            )

        if pending:
            return NormalizationResult(
                original,
                normalized_key,
                pending[0].canonical_name,
                pending[0].canonical_key,
                "pending_review",
                pending[0].confidence,
                ("Alias pendiente de revision administrativa.",),
            )

        return NormalizationResult(original, normalized_key, original, normalized_key, "canonical_guess", 0.6)

    def canonical_name(self, name: str | None, tournament: str | None = None, country: str | None = None) -> str:
        return self.resolve(name, tournament, country).canonical_name

    def canonical_key(self, name: str | None, tournament: str | None = None, country: str | None = None) -> str:
        return self.resolve(name, tournament, country).canonical_key

    def _candidates(self, alias_key: str, tournament: str | None, country: str | None) -> list[TeamAlias]:
        scopes = [
            (alias_key, (tournament or "").casefold(), (country or "").casefold()),
            (alias_key, (tournament or "").casefold(), ""),
            (alias_key, "", (country or "").casefold()),
            (alias_key, "", ""),
        ]
        seen: set[tuple[str, str]] = set()
        candidates: list[TeamAlias] = []
        for scope in scopes:
            for alias in self.alias_index.get(scope, []):
                marker = (alias.alias_key, alias.canonical_key)
                if marker not in seen:
                    seen.add(marker)
                    candidates.append(alias)
        return candidates


def normalize_match_teams(match: dict[str, Any], normalizer: TeamNormalizer | None = None) -> dict[str, Any]:
    normalizer = normalizer or TeamNormalizer()
    tournament = match.get("torneo")
    home = normalizer.resolve(match.get("local_nombre"), tournament=tournament)
    away = normalizer.resolve(match.get("visitante_nombre"), tournament=tournament)
    normalized = dict(match)
    normalized["local_nombre_original"] = match.get("local_nombre")
    normalized["visitante_nombre_original"] = match.get("visitante_nombre")
    normalized["local_nombre"] = home.canonical_name
    normalized["visitante_nombre"] = away.canonical_name
    normalized["team_normalization"] = {
        "version": NORMALIZATION_VERSION,
        "home": home.__dict__,
        "away": away.__dict__,
    }
    return normalized


def detect_potential_alias(name: str, canonical_name: str, confidence: float = 0.5) -> TeamAlias:
    return TeamAlias(
        canonical_name=canonical_name,
        alias=name,
        status="pending_review",
        confidence=confidence,
        source="detected",
    )

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .api_football_importer import ApiFootballClient, ApiFootballImporter
from .config import FootballApiSettings, load_football_api_settings
from .team_normalization import TeamNormalizer


SUPPORTED_PROVIDERS = {"api_football", "api-football"}


class ExternalFootballImporter(Protocol):
    def list_leagues(self, country: str | None = None) -> list[dict[str, Any]]:
        ...

    def list_seasons(self, league: str | int) -> list[Any]:
        ...

    def list_teams(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        ...

    def standings(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        ...

    def match_statistics(self, fixture_id: str | int) -> list[dict[str, Any]]:
        ...

    def import_season(self, league: str | int, season: str | int, include_upcoming: bool = False):
        ...


@dataclass(frozen=True)
class ExternalFootballApi:
    provider: str
    client: ApiFootballClient
    importer: ExternalFootballImporter


def create_external_football_api(
    provider: str | None = None,
    normalizer: TeamNormalizer | None = None,
    dry_run: bool | None = None,
) -> ExternalFootballApi:
    settings = load_football_api_settings(provider=provider, dry_run=dry_run)
    selected = settings.provider.casefold().replace("-", "_")

    if selected not in {item.replace("-", "_") for item in SUPPORTED_PROVIDERS}:
        raise ValueError(f"Proveedor de futbol no soportado: {settings.provider}")

    if not settings.api_key:
        raise RuntimeError("Missing FOOTBALL_API_KEY")

    client = ApiFootballClient(
        settings.api_key,
        settings.base_url,
        timeout=settings.timeout_seconds,
        sleep_seconds=settings.rate_limit_sleep_seconds,
        max_retries=settings.max_retries,
        dry_run=settings.dry_run,
    )
    return ExternalFootballApi(provider="api_football", client=client, importer=ApiFootballImporter(client, normalizer))

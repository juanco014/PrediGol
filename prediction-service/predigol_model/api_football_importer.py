from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from .importers import validate_and_normalize_rows
from .team_normalization import TeamNormalizer


PROVIDER_NAME = "api-football"
API_SOURCE = "api_football"
FINISHED_STATUSES = {"FT", "AET", "PEN"}
UPCOMING_STATUSES = {"NS", "TBD"}
LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"}
RATE_LIMIT_STATUS = 429


class ApiFootballError(RuntimeError):
    pass


class ApiFootballAuthError(ApiFootballError):
    pass


class ApiFootballRateLimitError(ApiFootballError):
    pass


class ApiFootballIncompleteResponse(ApiFootballError):
    pass


@dataclass(frozen=True)
class ApiFootballQuota:
    daily_limit: int | None = None
    daily_remaining: int | None = None
    minute_limit: int | None = None
    minute_remaining: int | None = None


@dataclass
class ApiFootballFetchResult:
    rows: list[dict[str, Any]]
    raw_count: int
    requests_count: int
    quota: ApiFootballQuota | None = None
    warnings: list[str] = field(default_factory=list)
    provider: str = PROVIDER_NAME


def _header_int(headers: httpx.Headers, name: str) -> int | None:
    value = headers.get(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _quota(headers: httpx.Headers) -> ApiFootballQuota:
    return ApiFootballQuota(
        daily_limit=_header_int(headers, "x-ratelimit-requests-limit"),
        daily_remaining=_header_int(headers, "x-ratelimit-requests-remaining"),
        minute_limit=_header_int(headers, "x-ratelimit-limit"),
        minute_remaining=_header_int(headers, "x-ratelimit-remaining"),
    )


def _clean_params(params: dict[str, Any] | None) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in (params or {}).items():
        if value is None or value == "":
            continue
        cleaned[key] = "***" if any(token in key.casefold() for token in ["key", "token", "secret"]) else value
    return cleaned


def _request_context(path: str, params: dict[str, Any] | None, errors: Any) -> str:
    safe_params = _clean_params(params)
    return (
        f"API-Football devolvio errores en endpoint {path}; "
        f"params={safe_params}; errores={errors}. "
        "Sugerencia: revisa que los parametros sean soportados por el endpoint y por tu plan."
    )


def map_status(status_short: str | None) -> str:
    if status_short in FINISHED_STATUSES:
        return "finalizado"
    if status_short in LIVE_STATUSES:
        return "en_vivo"
    if status_short in UPCOMING_STATUSES or not status_short:
        return "proximo"
    if status_short in {"PST", "CANC", "ABD", "AWD", "WO"}:
        return "cancelado"
    return "proximo"


def _score(value: Any) -> str:
    return "" if value is None else str(value)


def fixture_to_import_row(fixture: dict[str, Any]) -> dict[str, Any]:
    fixture_info = fixture.get("fixture") or {}
    league = fixture.get("league") or {}
    teams = fixture.get("teams") or {}
    goals = fixture.get("goals") or {}
    status_short = (fixture_info.get("status") or {}).get("short")
    estado = map_status(status_short)
    api_fixture_id = fixture_info.get("id")
    if api_fixture_id is None:
        raise ApiFootballIncompleteResponse("Fixture sin fixture.id")
    return {
        "fecha": fixture_info.get("date"),
        "torneo": league.get("name"),
        "temporada": league.get("season"),
        "jornada": league.get("round"),
        "local": (teams.get("home") or {}).get("name"),
        "visitante": (teams.get("away") or {}).get("name"),
        "estado": estado,
        "goles_local": _score(goals.get("home")) if estado == "finalizado" else "",
        "goles_visitante": _score(goals.get("away")) if estado == "finalizado" else "",
        "api_football_fixture_id": str(api_fixture_id),
        "api_football_league_id": league.get("id"),
        "status_short": status_short,
        "raw_api_football": fixture,
    }


class ApiFootballClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://v3.football.api-sports.io",
        timeout: float = 30.0,
        sleep_seconds: float = 0.25,
        max_retries: int = 3,
        dry_run: bool = False,
    ) -> None:
        if not api_key:
            raise ApiFootballAuthError("FOOTBALL_API_KEY no configurada")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.sleep_seconds = sleep_seconds
        self.max_retries = max(1, max_retries)
        self.dry_run = dry_run
        self.requests_count = 0
        self.last_quota: ApiFootballQuota | None = None

    def _request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = httpx.get(
                    f"{self.base_url}{path}",
                    params=_clean_params(params),
                    headers={"x-apisports-key": self.api_key},
                    timeout=self.timeout,
                )
                self.requests_count += 1
                self.last_quota = _quota(response.headers)
                if response.status_code in {401, 403}:
                    raise ApiFootballAuthError("API-Football rechazo la autenticacion o el plan")
                if response.status_code == RATE_LIMIT_STATUS:
                    raise ApiFootballRateLimitError("API-Football devolvio rate limit")
                response.raise_for_status()
                payload = response.json()
                errors = payload.get("errors") or {}
                if errors:
                    text = str(errors).casefold()
                    if "token" in text or "key" in text or "account" in text:
                        raise ApiFootballAuthError("API-Football devolvio error de autenticacion o plan")
                    if "rate" in text or "limit" in text or "quota" in text:
                        raise ApiFootballRateLimitError("API-Football devolvio limite de cuota")
                    raise ApiFootballError(_request_context(path, params, errors))
                return payload
            except (ApiFootballAuthError, ApiFootballRateLimitError):
                raise
            except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as error:
                last_error = error
                if attempt == self.max_retries - 1:
                    break
                time.sleep(0.5 * (attempt + 1))
        raise ApiFootballError(f"No fue posible consultar API-Football: {last_error}")

    def status(self) -> dict[str, Any]:
        return self._request("/status")

    def list_leagues(self, country: str | None = None, league: str | int | None = None, season: str | int | None = None) -> list[dict[str, Any]]:
        return list(self._request("/leagues", {"country": country, "id": league, "season": season}).get("response") or [])

    def list_teams(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        return list(self._request("/teams", {"league": league, "season": season}).get("response") or [])

    def standings(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        return list(self._request("/standings", {"league": league, "season": season}).get("response") or [])

    def fixture_statistics(self, fixture_id: str | int) -> list[dict[str, Any]]:
        return list(self._request("/fixtures/statistics", {"fixture": fixture_id}).get("response") or [])

    def seasons_for_league(self, league: str | int) -> list[Any]:
        seasons: list[Any] = []
        for item in self.list_leagues(league=league):
            for season in item.get("seasons") or []:
                year = season.get("year")
                if year is not None and year not in seasons:
                    seasons.append(year)
        return seasons

    def resolve_league_id(self, league_name: str, season: str | int | None = None, country: str | None = None) -> int:
        matches = self.list_leagues(country=country, season=season)
        wanted = " ".join(league_name.casefold().split())
        for item in matches:
            league = item.get("league") or {}
            name = " ".join(str(league.get("name") or "").casefold().split())
            if name == wanted:
                return int(league["id"])
        raise ApiFootballError(f"No se encontro liga '{league_name}' para temporada {season or 'sin filtro'}")

    def fixtures(self, params: dict[str, Any]) -> ApiFootballFetchResult:
        warnings: list[str] = []
        start_requests = self.requests_count
        payload = self._request("/fixtures", params)
        rows = payload.get("response")
        if rows is None:
            raise ApiFootballIncompleteResponse("Respuesta sin campo response")
        if self.last_quota and self.last_quota.minute_remaining == 0:
            warnings.append("La cuota por minuto quedo en cero durante la consulta.")
        return ApiFootballFetchResult(rows=rows, raw_count=len(rows), requests_count=self.requests_count - start_requests, quota=self.last_quota, warnings=warnings)


class ApiFootballImporter:
    def __init__(self, client: ApiFootballClient, normalizer: TeamNormalizer | None = None) -> None:
        self.client = client
        self.normalizer = normalizer or TeamNormalizer()

    def list_leagues(self, country: str | None = None) -> list[dict[str, Any]]:
        return self.client.list_leagues(country=country)

    def list_seasons(self, league: str | int) -> list[Any]:
        return self.client.seasons_for_league(league)

    def list_teams(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        return self.client.list_teams(league, season)

    def standings(self, league: str | int, season: str | int) -> list[dict[str, Any]]:
        return self.client.standings(league, season)

    def match_statistics(self, fixture_id: str | int) -> list[dict[str, Any]]:
        return self.client.fixture_statistics(fixture_id)

    def import_season(self, league: str | int, season: str | int, include_upcoming: bool = False) -> tuple[Any, ApiFootballFetchResult]:
        fetched = self.client.fixtures({"league": league, "season": season})
        return self._normalize_fetch(fetched, include_upcoming=include_upcoming)

    def import_range(self, league: str | int, season: str | int | None, desde: str, hasta: str, only_finished: bool = False, include_upcoming: bool = False) -> tuple[Any, ApiFootballFetchResult]:
        fetched = self.client.fixtures({"league": league, "season": season, "from": desde, "to": hasta})
        return self._normalize_fetch(fetched, only_finished=only_finished, include_upcoming=include_upcoming)

    def sync_window(self, league: str | int, season: str | int | None, days_back: int = 7, days_forward: int = 30) -> tuple[Any, ApiFootballFetchResult]:
        today = date.today()
        return self.import_range(
            league=league,
            season=season,
            desde=(today - timedelta(days=days_back)).isoformat(),
            hasta=(today + timedelta(days=days_forward)).isoformat(),
            include_upcoming=True,
        )

    def _normalize_fetch(self, fetched: ApiFootballFetchResult, only_finished: bool = False, include_upcoming: bool = False) -> tuple[Any, ApiFootballFetchResult]:
        rows: list[dict[str, Any]] = []
        for fixture in fetched.rows:
            row = fixture_to_import_row(fixture)
            if only_finished and row["estado"] != "finalizado":
                continue
            if row["estado"] != "finalizado" and not include_upcoming:
                continue
            rows.append(row)
        result = validate_and_normalize_rows(rows, API_SOURCE, self.normalizer, allow_non_finished=include_upcoming)
        for valid in result.valid:
            raw = valid.get("payload_api", {}).get("raw", {})
            api_raw = raw.get("raw_api_football") or raw
            internal = {
                "external_match_id": str(valid.get("api_football_fixture_id")),
                "provider": PROVIDER_NAME,
                "league_id": raw.get("api_football_league_id"),
                "league_name": valid.get("torneo"),
                "season": valid.get("temporada"),
                "match_date": valid.get("fecha_orden"),
                "home_team": valid.get("local_nombre"),
                "away_team": valid.get("visitante_nombre"),
                "home_score": valid.get("goles_local_final"),
                "away_score": valid.get("goles_visitante_final"),
                "status": valid.get("estado"),
                "round": valid.get("ronda"),
                "venue": ((api_raw.get("fixture") or {}).get("venue") or {}).get("name"),
                "raw_payload": api_raw,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            valid["origen_datos"] = API_SOURCE
            valid["fuente_detalle"] = PROVIDER_NAME
            valid["api_football_league_id"] = raw.get("api_football_league_id")
            valid["payload_api"]["provider"] = PROVIDER_NAME
            valid["payload_api"]["source"] = API_SOURCE
            valid["payload_api"]["internal_match"] = internal
            valid["payload_api"]["raw_api_football"] = api_raw
            valid["payload_api"]["imported_at"] = datetime.now(timezone.utc).isoformat()
        return result, fetched

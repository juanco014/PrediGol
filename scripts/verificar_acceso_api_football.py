from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import httpx

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_football_api_settings  # noqa: E402


DEFAULT_LEAGUE = 140
DEFAULT_SEASON = 2025
DEFAULT_NEXT = 3
MAX_NEXT = 5
MAX_REQUESTS = 1
FINISHED_STATUSES = {"FT", "AET", "PEN"}
UPCOMING_STATUSES = {"NS", "TBD"}


class HttpGetter(Protocol):
    def __call__(self, url: str, *, params: dict[str, Any], headers: dict[str, str], timeout: float) -> httpx.Response:
        ...


@dataclass
class AccessResult:
    status: str
    reason: str
    requests_count: int
    raw_count: int = 0
    future_fixtures: int = 0
    rejected_fixtures: int = 0
    quota: dict[str, int | None] | None = None
    fixtures: list[dict[str, Any]] | None = None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Preflight conservador de acceso API-Football sin escritura.")
    parser.add_argument("--league", type=int, default=DEFAULT_LEAGUE, help=f"ID de liga API-Football. Default {DEFAULT_LEAGUE}.")
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON, help=f"Temporada API-Football. Default {DEFAULT_SEASON}.")
    parser.add_argument("--next", type=int, default=DEFAULT_NEXT, help=f"Cantidad de proximos fixtures. Maximo {MAX_NEXT}.")
    parser.add_argument("--date-from")
    parser.add_argument("--date-to")
    parser.add_argument("--dry-run", action="store_true", help="No escribe en Supabase. Este script nunca escribe.")
    return parser


def header_int(headers: httpx.Headers, name: str) -> int | None:
    value = headers.get(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def quota_from_headers(headers: httpx.Headers) -> dict[str, int | None]:
    return {
        "daily_limit": header_int(headers, "x-ratelimit-requests-limit"),
        "daily_remaining": header_int(headers, "x-ratelimit-requests-remaining"),
        "minute_limit": header_int(headers, "x-ratelimit-limit"),
        "minute_remaining": header_int(headers, "x-ratelimit-remaining"),
    }


def classify_api_errors(errors: Any) -> tuple[str, str]:
    text = json.dumps(errors, ensure_ascii=False, default=str).casefold()
    if "free plans do not have access" in text or "plan" in text or "subscription" in text:
        return "season_not_in_plan", "temporada no incluida en el plan actual"
    if "invalid" in text and ("key" in text or "token" in text or "account" in text):
        return "invalid_key", "clave invalida o no autorizada"
    if "rate" in text or "quota" in text or "limit" in text:
        return "quota_exhausted", "cuota o rate limit agotado"
    if "league" in text:
        return "league_unavailable", "liga no disponible o parametros de liga invalidos"
    return "api_error", "API-Football devolvio errores"


def validate_args(args: argparse.Namespace) -> None:
    if args.next < 1 or args.next > MAX_NEXT:
        raise ValueError(f"--next debe estar entre 1 y {MAX_NEXT}.")
    if bool(args.date_from) != bool(args.date_to):
        raise ValueError("--date-from y --date-to deben usarse juntos.")
    if args.date_from and args.next != DEFAULT_NEXT:
        raise ValueError("Usa --next o rango de fechas, no ambos en esta verificacion conservadora.")


def build_params(args: argparse.Namespace) -> dict[str, Any]:
    params: dict[str, Any] = {"league": args.league, "season": args.season}
    if args.date_from and args.date_to:
        params.update({"from": args.date_from, "to": args.date_to})
    else:
        params["next"] = args.next
    return params


def parse_fixture_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def fixture_summary(fixture: dict[str, Any], now: datetime) -> dict[str, Any]:
    fixture_info = fixture.get("fixture") or {}
    league = fixture.get("league") or {}
    teams = fixture.get("teams") or {}
    status = fixture_info.get("status") or {}
    kickoff = parse_fixture_datetime(fixture_info.get("date"))
    status_short = status.get("short")
    reasons: list[str] = []
    if kickoff is None:
        reasons.append("fecha invalida")
    elif kickoff <= now:
        reasons.append("fixture pasado")
    if status_short in FINISHED_STATUSES:
        reasons.append("partido finalizado")
    if status_short not in UPCOMING_STATUSES:
        reasons.append("estado no proximo")
    if not (teams.get("home") or {}).get("id") or not (teams.get("away") or {}).get("id"):
        reasons.append("equipos incompletos")
    return {
        "api_football_fixture_id": fixture_info.get("id"),
        "league": {"id": league.get("id"), "name": league.get("name")},
        "season": league.get("season"),
        "teams": {"home": (teams.get("home") or {}).get("name"), "away": (teams.get("away") or {}).get("name")},
        "kickoff_at": fixture_info.get("date"),
        "kickoff_utc": kickoff.isoformat() if kickoff else None,
        "timezone": fixture_info.get("timezone"),
        "status": {"short": status_short, "long": status.get("long")},
        "valid_future_fixture": not reasons,
        "reasons": reasons,
    }


def preflight(args: argparse.Namespace, getter: HttpGetter | None = None, now: datetime | None = None) -> AccessResult:
    validate_args(args)
    settings = load_football_api_settings(dry_run=True)
    if not settings.api_key:
        return AccessResult("invalid_key", "FOOTBALL_API_KEY no configurada", 0, fixtures=[])

    requests_count = 0
    params = build_params(args)
    current = now or datetime.now(timezone.utc)
    getter = getter or httpx.get
    try:
        requests_count += 1
        if requests_count > MAX_REQUESTS:
            return AccessResult("max_requests_exceeded", "limite de solicitudes excedido", requests_count, fixtures=[])
        response = getter(
            f"{settings.base_url.rstrip('/')}/fixtures",
            params=params,
            headers={"x-apisports-key": settings.api_key},
            timeout=settings.timeout_seconds,
        )
    except (httpx.TimeoutException, httpx.TransportError) as error:
        return AccessResult("network_error", error.__class__.__name__, requests_count, fixtures=[])

    quota = quota_from_headers(response.headers)
    try:
        payload = response.json()
    except ValueError:
        return AccessResult("malformed_response", "respuesta no es JSON valido", requests_count, quota=quota, fixtures=[])

    if response.status_code in {401, 403}:
        return AccessResult("invalid_key", "clave invalida, sin autorizacion o plan no permitido", requests_count, quota=quota, fixtures=[])
    if response.status_code == 429:
        return AccessResult("quota_exhausted", "API-Football devolvio rate limit", requests_count, quota=quota, fixtures=[])
    if response.status_code >= 400:
        return AccessResult("api_error", f"HTTP {response.status_code}", requests_count, quota=quota, fixtures=[])

    errors = payload.get("errors") if isinstance(payload, dict) else None
    if errors:
        status, reason = classify_api_errors(errors)
        return AccessResult(status, reason, requests_count, quota=quota, fixtures=[])

    rows = payload.get("response") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        return AccessResult("malformed_response", "respuesta sin lista response", requests_count, quota=quota, fixtures=[])

    fixtures = [fixture_summary(row, current) for row in rows if isinstance(row, dict)]
    future_count = sum(1 for item in fixtures if item["valid_future_fixture"])
    rejected = len(fixtures) - future_count
    if not fixtures:
        return AccessResult("valid_zero_fixtures", "acceso permitido; respuesta valida sin fixtures", requests_count, 0, 0, 0, quota, [])
    return AccessResult("access_allowed", "acceso permitido", requests_count, len(fixtures), future_count, rejected, quota, fixtures)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = preflight(args)
    except ValueError as error:
        print(json.dumps({"ok": False, "status": "invalid_params", "error": str(error)}, ensure_ascii=False, indent=2))
        return 2
    payload = {
        "ok": result.status in {"access_allowed", "valid_zero_fixtures"},
        "mode": "dry-run",
        "provider": "api_football",
        "host": os.environ.get("FOOTBALL_API_BASE_URL") or os.environ.get("API_FOOTBALL_BASE_URL") or "https://v3.football.api-sports.io",
        "request": build_params(args),
        "status": result.status,
        "reason": result.reason,
        "requests_count": result.requests_count,
        "max_requests": MAX_REQUESTS,
        "raw_count": result.raw_count,
        "future_fixtures": result.future_fixtures,
        "rejected_fixtures": result.rejected_fixtures,
        "quota": result.quota,
        "fixtures": result.fixtures or [],
        "secrets_printed": False,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_settings  # noqa: E402
from predigol_model.supabase_client import SupabaseRestClient  # noqa: E402


MAX_LIMIT = 10
DEFAULT_LIMIT = 5
UPCOMING_STATUS_SHORT = {"NS", "TBD"}
FINISHED_STATUS_SHORT = {"FT", "AET", "PEN"}
FINISHED_STATUS = {"finalizado", "finished", "match finished"}
PLACEHOLDER_IDS = {"", "0", "-1", "999", "9999", "123", "1234", "12345", "123456"}


class FixtureClient(Protocol):
    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        ...

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        ...


@dataclass
class Candidate:
    api_football_fixture_id: int | None
    league_id: int | None
    league_name: str
    season: int | None
    home_team_id: int | None
    away_team_id: int | None
    home_team: str
    away_team: str
    kickoff_at: str
    timezone_name: str | None
    status: str
    status_short: str
    source: str
    raw_payload: dict[str, Any]


@dataclass
class PlanItem:
    candidate: Candidate
    operation: str
    reason: str
    errors: list[str] = field(default_factory=list)


@dataclass
class ImportSummary:
    inserted: int = 0
    omitted: int = 0
    errors: int = 0
    supabase_errors: list[str] = field(default_factory=list)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Importar fixtures reales proximos MVP con control estricto.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Valida y muestra el plan sin escribir. Es el modo por defecto.")
    mode.add_argument("--apply", action="store_true", help="Inserta fixtures validados en Supabase.")
    parser.add_argument("--source", help="Archivo CSV/JSON verificable con fixtures proximos reales.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Maximo de registros a procesar. Maximo {MAX_LIMIT}.")
    parser.add_argument("--allow-overwrite", action="store_true", help="Reservado: no habilitado para MVP.")
    return parser


def parse_positive_int(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if text in PLACEHOLDER_IDS:
        return None
    try:
        parsed = int(text)
    except ValueError:
        return None
    return parsed if parsed > 0 else None


def parse_kickoff(value: str, now: datetime | None = None) -> tuple[datetime | None, str | None]:
    if not value:
        return None, "fecha vacia"
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None, "fecha invalida"
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    if parsed <= current:
        return parsed, "fecha pasada o no futura"
    return parsed, None


def status_from_raw(raw_status: str, status_short: str) -> str:
    status = (raw_status or "").strip().casefold()
    if status in {"proximo", "upcoming"} or status_short in UPCOMING_STATUS_SHORT:
        return "proximo"
    if status in FINISHED_STATUS or status_short in FINISHED_STATUS_SHORT:
        return "finalizado"
    return status or "proximo"


def load_source(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(path)
    if path.suffix.casefold() == ".csv":
        with path.open(newline="", encoding="utf-8") as file:
            return [dict(row) for row in csv.DictReader(file)]
    if path.suffix.casefold() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("response"), list):
            return list(payload["response"])
        if isinstance(payload, dict) and isinstance(payload.get("fixtures"), list):
            return list(payload["fixtures"])
        if isinstance(payload, list):
            return payload
        raise ValueError("JSON debe ser lista, {'response': [...]} o {'fixtures': [...]}.")
    raise ValueError("Solo se admiten archivos .csv o .json.")


def candidate_from_api_football(raw: dict[str, Any], fallback_source: str) -> Candidate:
    fixture = raw.get("fixture") or {}
    league = raw.get("league") or {}
    teams = raw.get("teams") or {}
    home = teams.get("home") or {}
    away = teams.get("away") or {}
    status_short = str((fixture.get("status") or {}).get("short") or "NS")
    source = str(raw.get("source") or raw.get("source_url") or fallback_source)
    return Candidate(
        api_football_fixture_id=parse_positive_int(fixture.get("id")),
        league_id=parse_positive_int(league.get("id")),
        league_name=str(league.get("name") or ""),
        season=parse_positive_int(league.get("season")),
        home_team_id=parse_positive_int(home.get("id")),
        away_team_id=parse_positive_int(away.get("id")),
        home_team=str(home.get("name") or ""),
        away_team=str(away.get("name") or ""),
        kickoff_at=str(fixture.get("date") or ""),
        timezone_name=fixture.get("timezone"),
        status=status_from_raw(str((fixture.get("status") or {}).get("long") or ""), status_short),
        status_short=status_short,
        source=source,
        raw_payload=raw,
    )


def candidate_from_flat_row(raw: dict[str, Any], fallback_source: str) -> Candidate:
    status_short = str(raw.get("status_short") or raw.get("estado_api") or "NS")
    raw_status = str(raw.get("status") or raw.get("estado") or "proximo")
    return Candidate(
        api_football_fixture_id=parse_positive_int(raw.get("api_football_fixture_id") or raw.get("fixture_id") or raw.get("external_id")),
        league_id=parse_positive_int(raw.get("api_football_league_id") or raw.get("league_id")),
        league_name=str(raw.get("league") or raw.get("torneo") or ""),
        season=parse_positive_int(raw.get("season") or raw.get("temporada")),
        home_team_id=parse_positive_int(raw.get("home_team_api_id") or raw.get("home_team_id")),
        away_team_id=parse_positive_int(raw.get("away_team_api_id") or raw.get("away_team_id")),
        home_team=str(raw.get("home_team") or raw.get("local") or raw.get("local_nombre") or ""),
        away_team=str(raw.get("away_team") or raw.get("visitante") or raw.get("visitante_nombre") or ""),
        kickoff_at=str(raw.get("kickoff_at") or raw.get("fecha_orden") or raw.get("fecha") or ""),
        timezone_name=raw.get("timezone"),
        status=status_from_raw(raw_status, status_short),
        status_short=status_short,
        source=str(raw.get("source") or raw.get("source_url") or raw.get("fuente") or fallback_source),
        raw_payload=raw,
    )


def normalize_candidates(rows: list[dict[str, Any]], fallback_source: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if "fixture" in row and "teams" in row:
            candidates.append(candidate_from_api_football(row, fallback_source))
        else:
            candidates.append(candidate_from_flat_row(row, fallback_source))
    return candidates


def validate_candidate(candidate: Candidate, now: datetime | None = None) -> list[str]:
    errors: list[str] = []
    if candidate.api_football_fixture_id is None:
        errors.append("identificador API-Football vacio, invalido o ficticio")
    if candidate.league_id is None or not candidate.league_name.strip():
        errors.append("liga incompleta")
    if candidate.season is None:
        errors.append("temporada incompleta")
    if candidate.home_team_id is None or candidate.away_team_id is None:
        errors.append("identificadores de equipos incompletos")
    if not candidate.home_team.strip() or not candidate.away_team.strip():
        errors.append("equipos incompletos")
    if candidate.home_team_id is not None and candidate.home_team_id == candidate.away_team_id:
        errors.append("equipos duplicados")
    if not candidate.source.strip() or candidate.source.strip().casefold() in {"manual", "desconocida", "unknown"}:
        errors.append("fuente no verificable")
    kickoff, date_error = parse_kickoff(candidate.kickoff_at, now=now)
    if date_error:
        errors.append(date_error)
    if candidate.status == "finalizado" or candidate.status_short in FINISHED_STATUS_SHORT:
        errors.append("partido finalizado rechazado")
    if candidate.status != "proximo" or candidate.status_short not in UPCOMING_STATUS_SHORT:
        errors.append("estado no permitido para fixture proximo")
    if kickoff and candidate.season and kickoff.year < candidate.season - 1:
        errors.append("fecha incompatible con temporada")
    return errors


def fetch_existing(client: FixtureClient, fixture_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not fixture_ids:
        return {}
    params = {
        "select": "api_football_fixture_id,kickoff_at,home_team_api_id,away_team_api_id,status,status_short",
        "api_football_fixture_id": f"in.({','.join(str(item) for item in fixture_ids)})",
        "limit": str(len(fixture_ids)),
    }
    rows = client.select("football_fixtures", params)
    return {int(row["api_football_fixture_id"]): row for row in rows if row.get("api_football_fixture_id") is not None}


def is_consistent_duplicate(candidate: Candidate, existing: dict[str, Any]) -> bool:
    return (
        str(existing.get("home_team_api_id")) == str(candidate.home_team_id)
        and str(existing.get("away_team_api_id")) == str(candidate.away_team_id)
        and str(existing.get("kickoff_at") or "")[:16] == candidate.kickoff_at[:16]
    )


def build_plan(candidates: list[Candidate], client: FixtureClient | None, *, limit: int, now: datetime | None = None) -> list[PlanItem]:
    if limit < 1 or limit > MAX_LIMIT:
        raise ValueError(f"--limit debe estar entre 1 y {MAX_LIMIT}.")
    limited = candidates[:limit]
    duplicate_ids = {item.api_football_fixture_id for item in limited if item.api_football_fixture_id is not None and sum(1 for other in limited if other.api_football_fixture_id == item.api_football_fixture_id) > 1}
    existing = fetch_existing(client, [int(item.api_football_fixture_id) for item in limited if item.api_football_fixture_id is not None]) if client else {}
    plan: list[PlanItem] = []
    for candidate in limited:
        errors = validate_candidate(candidate, now=now)
        if candidate.api_football_fixture_id in duplicate_ids:
            errors.append("identificador duplicado en la fuente")
        if candidate.api_football_fixture_id in existing:
            row = existing[int(candidate.api_football_fixture_id)]
            if is_consistent_duplicate(candidate, row):
                plan.append(PlanItem(candidate, "omit", "duplicado existente consistente", errors))
            else:
                plan.append(PlanItem(candidate, "error", "duplicado existente inconsistente", [*errors, "duplicado inconsistente en Supabase"]))
            continue
        if errors:
            plan.append(PlanItem(candidate, "error", "; ".join(errors), errors))
        else:
            plan.append(PlanItem(candidate, "insert", "fixture proximo valido"))
    return plan


def short_name(name: str) -> str:
    parts = [part for part in name.split() if part]
    initials = "".join(part[0] for part in parts[:3]).upper()
    return initials or name[:3].upper()


def team_rows(candidate: Candidate) -> list[dict[str, Any]]:
    return [
        {"api_football_team_id": candidate.home_team_id, "name": candidate.home_team, "raw_payload": {"source": candidate.source}, "updated_at": datetime.now(timezone.utc).isoformat()},
        {"api_football_team_id": candidate.away_team_id, "name": candidate.away_team, "raw_payload": {"source": candidate.source}, "updated_at": datetime.now(timezone.utc).isoformat()},
    ]


def fixture_row(candidate: Candidate) -> dict[str, Any]:
    return {
        "api_football_fixture_id": candidate.api_football_fixture_id,
        "competition_api_id": candidate.league_id,
        "season_start_year": candidate.season,
        "round": candidate.raw_payload.get("round") or candidate.raw_payload.get("ronda") or (candidate.raw_payload.get("league") or {}).get("round"),
        "kickoff_at": candidate.kickoff_at,
        "timezone": candidate.timezone_name,
        "status": candidate.status,
        "status_short": candidate.status_short,
        "home_team_api_id": candidate.home_team_id,
        "away_team_api_id": candidate.away_team_id,
        "raw_payload": {**candidate.raw_payload, "source": candidate.source, "imported_by": "importar_fixtures_proximos_mvp"},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def partido_row(candidate: Candidate) -> dict[str, Any]:
    return {
        "id": str(candidate.api_football_fixture_id),
        "api_football_fixture_id": candidate.api_football_fixture_id,
        "api_football_league_id": candidate.league_id,
        "temporada": candidate.season,
        "ronda": candidate.raw_payload.get("round") or candidate.raw_payload.get("ronda") or (candidate.raw_payload.get("league") or {}).get("round"),
        "torneo": candidate.league_name,
        "fecha_texto": candidate.kickoff_at,
        "fecha_orden": candidate.kickoff_at,
        "local_nombre": candidate.home_team,
        "visitante_nombre": candidate.away_team,
        "local_corto": short_name(candidate.home_team),
        "visitante_corto": short_name(candidate.away_team),
        "estado": "proximo",
        "goles_local_final": None,
        "goles_visitante_final": None,
        "payload_api": {**candidate.raw_payload, "source": candidate.source, "imported_by": "importar_fixtures_proximos_mvp"},
        "actualizado_api_en": datetime.now(timezone.utc).isoformat(),
        "origen_datos": "api_football",
        "fuente_detalle": candidate.source,
        "creado_manual_en": None,
    }


def apply_plan(plan: list[PlanItem], client: FixtureClient) -> ImportSummary:
    summary = ImportSummary()
    for item in plan:
        if item.operation == "omit":
            summary.omitted += 1
            continue
        if item.operation != "insert" or item.errors:
            summary.errors += 1
            continue
        try:
            candidate = item.candidate
            client.upsert("football_teams", team_rows(candidate), on_conflict="api_football_team_id")
            client.upsert("football_fixtures", [fixture_row(candidate)], on_conflict="api_football_fixture_id")
            client.upsert("partidos", [partido_row(candidate)], on_conflict="api_football_fixture_id")
            summary.inserted += 1
        except Exception as error:  # noqa: BLE001
            summary.errors += 1
            summary.supabase_errors.append(error.__class__.__name__)
    return summary


def plan_to_dict(plan: list[PlanItem]) -> list[dict[str, Any]]:
    rows = []
    for item in plan:
        candidate = item.candidate
        rows.append(
            {
                "external_id": candidate.api_football_fixture_id,
                "league": {"id": candidate.league_id, "name": candidate.league_name},
                "season": candidate.season,
                "teams": {"home": candidate.home_team, "away": candidate.away_team},
                "kickoff_at": candidate.kickoff_at,
                "timezone": candidate.timezone_name,
                "status": {"mapped": candidate.status, "short": candidate.status_short},
                "source": candidate.source,
                "operation": item.operation,
                "reason": item.reason,
                "errors": item.errors,
            }
        )
    return rows


def quota_summary(requests_this_script: int) -> dict[str, Any]:
    return {
        "api_football_requests_this_script": requests_this_script,
        "api_football_requests_this_phase": "ver resumen de fase; este script no consulta API-Football",
        "api_football_quota_total_known": None,
        "api_football_quota_note": "No se declara cuota 0: este importador solo lee archivo/Supabase y no conoce la cuota total del proveedor.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.allow_overwrite:
        parser.error("--allow-overwrite no esta habilitado en el MVP.")
    if args.limit < 1 or args.limit > MAX_LIMIT:
        parser.error(f"--limit debe estar entre 1 y {MAX_LIMIT}.")
    if args.apply and not args.source:
        parser.error("--apply requiere --source explicito.")

    dry_run = not args.apply
    client = None
    try:
        settings = load_settings()
        client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
    except Exception:
        client = None

    candidates: list[Candidate] = []
    if args.source:
        path = Path(args.source)
        candidates = normalize_candidates(load_source(path), fallback_source=str(path))

    plan = build_plan(candidates, client, limit=args.limit)
    summary = ImportSummary()
    if args.apply:
        if client is None:
            print("ERROR: --apply requiere Supabase configurado. No se muestran secretos.")
            return 1
        summary = apply_plan(plan, client)
    else:
        summary.omitted = sum(1 for item in plan if item.operation == "omit")
        summary.errors = sum(1 for item in plan if item.operation == "error")

    payload = {
        "mode": "dry-run" if dry_run else "apply",
        "source": args.source,
        "limit": args.limit,
        "dry_run_no_write": dry_run,
        "candidates": plan_to_dict(plan),
        "summary": {
            "inserted": summary.inserted,
            "omitted": summary.omitted,
            "errors": summary.errors,
            "supabase_errors": summary.supabase_errors,
        },
        "quota": quota_summary(0),
        "status": "prepared_no_source" if not args.source else "validated",
    }
    if not args.source:
        payload["message"] = "Fase 7G preparada: proporciona --source CSV/JSON verificable para importar fixtures reales proximos. No se consulto API-Football."
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if summary.errors == 0 or dry_run else 1


if __name__ == "__main__":
    raise SystemExit(main())

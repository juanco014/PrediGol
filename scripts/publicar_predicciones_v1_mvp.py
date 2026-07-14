from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import httpx

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_settings  # noqa: E402
from predigol_model.poisson_elo import MODEL_VERSION, PoissonEloModel  # noqa: E402
from predigol_model.supabase_client import SupabaseRestClient  # noqa: E402


MAX_LIMIT = 10
DEFAULT_LIMIT = 5
DEFAULT_FREE_COUNT = 1
MIN_HISTORY = 30


class ReadClient(Protocol):
    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        ...


@dataclass
class PublishPlanItem:
    fixture_id: int
    partido_id: str | None
    home: str
    away: str
    kickoff_at: str | None
    access_tier: str
    action: str
    reason: str
    payload: dict[str, Any] | None = None


@dataclass
class PublishSummary:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0


class PredictionWriteClient:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = f"{url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def insert_prediction(self, row: dict[str, Any]) -> dict[str, Any]:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = httpx.post(f"{self.base_url}/model_predictions", headers=headers, json=row, timeout=30)
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else row

    def update_prediction(self, fixture_id: int, row: dict[str, Any]) -> dict[str, Any]:
        headers = {**self.headers, "Prefer": "return=representation"}
        response = httpx.patch(
            f"{self.base_url}/model_predictions",
            params={"api_football_fixture_id": f"eq.{fixture_id}"},
            headers=headers,
            json=row,
            timeout=30,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else row


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Publicar muestra MVP de predicciones reales V1 en Supabase.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Muestra el plan sin escribir en Supabase.")
    mode.add_argument("--apply", action="store_true", help="Publica predicciones validas en Supabase.")
    parser.add_argument("--fixture-id", action="append", type=int, help="Fixture API-Football especifico. Se puede repetir.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Maximo de predicciones a preparar. Maximo {MAX_LIMIT}.")
    parser.add_argument("--free-count", type=int, default=DEFAULT_FREE_COUNT, help="Cantidad inicial clasificada como free; el resto sera premium.")
    parser.add_argument("--allow-update", action="store_true", help="Permite actualizar predicciones existentes para fixtures seleccionados.")
    parser.add_argument("--min-history", type=int, default=MIN_HISTORY)
    return parser


def fetch_history(client: ReadClient, limit: int = 2000) -> list[dict[str, Any]]:
    return client.select(
        "partidos",
        {
            "select": "id,api_football_fixture_id,torneo,fecha_orden,local_nombre,visitante_nombre,goles_local_final,goles_visitante_final,estado",
            "estado": "eq.finalizado",
            "goles_local_final": "not.is.null",
            "goles_visitante_final": "not.is.null",
            "order": "fecha_orden.asc",
            "limit": str(limit),
        },
    )


def fetch_upcoming(client: ReadClient, limit: int, fixture_ids: list[int] | None = None) -> list[dict[str, Any]]:
    params = {
        "select": "id,api_football_fixture_id,torneo,fecha_orden,local_nombre,visitante_nombre,estado,es_relevante",
        "estado": "eq.proximo",
        "api_football_fixture_id": "not.is.null",
        "order": "fecha_orden.asc",
        "limit": str(limit),
    }
    if fixture_ids:
        params["api_football_fixture_id"] = f"in.({','.join(str(item) for item in fixture_ids)})"
    return client.select("partidos", params)


def fetch_existing_predictions(client: ReadClient, fixture_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not fixture_ids:
        return {}
    rows = client.select(
        "model_predictions",
        {
            "select": "api_football_fixture_id,partido_id,model_version,access_tier,generated_at",
            "api_football_fixture_id": f"in.({','.join(str(item) for item in fixture_ids)})",
            "limit": str(len(fixture_ids)),
        },
    )
    return {int(row["api_football_fixture_id"]): row for row in rows if row.get("api_football_fixture_id") is not None}


def validate_limit(limit: int) -> int:
    if limit < 1:
        raise ValueError("--limit debe ser mayor que cero.")
    if limit > MAX_LIMIT:
        raise ValueError(f"--limit no puede superar {MAX_LIMIT} en publicacion MVP controlada.")
    return limit


def validate_probability_payload(payload: dict[str, Any]) -> None:
    values = [payload.get("home_win_probability"), payload.get("draw_probability"), payload.get("away_win_probability")]
    numbers = [float(value) for value in values]
    if any(value < 0 or value > 1 for value in numbers):
        raise ValueError("probabilidades fuera de rango 0..1")
    if abs(sum(numbers) - 1.0) > 0.02:
        raise ValueError("probabilidades 1X2 no suman aproximadamente 1")
    if payload.get("model_version") != MODEL_VERSION:
        raise ValueError("solo se permite publicar V1")


def prediction_payload(prediction: Any, match: dict[str, Any], access_tier: str) -> dict[str, Any]:
    if access_tier not in {"free", "premium"}:
        raise ValueError("access_tier invalido")
    payload = prediction.to_payload()
    payload.update(
        {
            "access_tier": access_tier,
            "premium_reason": "Requiere plan premium." if access_tier == "premium" else None,
            "premium_preview": {
                "source": "fase_7f_v1_mvp",
                "message": "Prediccion premium generada por V1 disponible para usuarios premium.",
            }
            if access_tier == "premium"
            else {},
            "metadata": {
                **(payload.get("metadata") or {}),
                "source": "fase_7f_v1_mvp",
                "fixture_real": True,
                "partido_id": str(match.get("id")),
                "generated_model": MODEL_VERSION,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    validate_probability_payload(payload)
    return payload


def build_plan(
    history: list[dict[str, Any]],
    upcoming: list[dict[str, Any]],
    existing: dict[int, dict[str, Any]],
    *,
    limit: int,
    free_count: int,
    allow_update: bool = False,
    min_history: int = MIN_HISTORY,
) -> list[PublishPlanItem]:
    validate_limit(limit)
    if free_count < 0:
        raise ValueError("--free-count no puede ser negativo.")
    if len(history) < min_history:
        raise RuntimeError(f"Historico insuficiente para V1: {len(history)} partidos; minimo {min_history}.")
    selected = upcoming[:limit]
    if not selected:
        return []
    model = PoissonEloModel(history)
    plan: list[PublishPlanItem] = []
    for index, match in enumerate(selected):
        fixture_id = match.get("api_football_fixture_id")
        if fixture_id is None:
            plan.append(PublishPlanItem(0, str(match.get("id") or ""), str(match.get("local_nombre") or ""), str(match.get("visitante_nombre") or ""), match.get("fecha_orden"), "free", "omit", "fixture sin api_football_fixture_id"))
            continue
        fixture_id = int(fixture_id)
        access_tier = "free" if index < free_count else "premium"
        try:
            payload = prediction_payload(model.predict(match), match, access_tier)
        except Exception as error:  # noqa: BLE001
            plan.append(PublishPlanItem(fixture_id, str(match.get("id") or ""), str(match.get("local_nombre") or ""), str(match.get("visitante_nombre") or ""), match.get("fecha_orden"), access_tier, "error", str(error)))
            continue
        if fixture_id in existing and not allow_update:
            plan.append(PublishPlanItem(fixture_id, payload.get("partido_id"), str(match.get("local_nombre") or ""), str(match.get("visitante_nombre") or ""), match.get("fecha_orden"), access_tier, "omit", "prediccion existente; use --allow-update para actualizar", payload))
        elif fixture_id in existing and allow_update:
            plan.append(PublishPlanItem(fixture_id, payload.get("partido_id"), str(match.get("local_nombre") or ""), str(match.get("visitante_nombre") or ""), match.get("fecha_orden"), access_tier, "update", "actualizacion explicita permitida", payload))
        else:
            plan.append(PublishPlanItem(fixture_id, payload.get("partido_id"), str(match.get("local_nombre") or ""), str(match.get("visitante_nombre") or ""), match.get("fecha_orden"), access_tier, "insert", "nueva prediccion V1", payload))
    return plan


def apply_plan(plan: list[PublishPlanItem], writer: PredictionWriteClient) -> PublishSummary:
    summary = PublishSummary()
    for item in plan:
        if item.action == "omit":
            summary.skipped += 1
            continue
        if item.action == "error" or not item.payload:
            summary.errors += 1
            continue
        try:
            if item.action == "insert":
                writer.insert_prediction(item.payload)
                summary.inserted += 1
            elif item.action == "update":
                writer.update_prediction(item.fixture_id, item.payload)
                summary.updated += 1
            else:
                summary.skipped += 1
        except Exception:  # noqa: BLE001
            summary.errors += 1
    return summary


def plan_to_dict(plan: list[PublishPlanItem]) -> list[dict[str, Any]]:
    rows = []
    for item in plan:
        payload = item.payload or {}
        rows.append(
            {
                "fixture_id": item.fixture_id,
                "partido_id": item.partido_id,
                "home": item.home,
                "away": item.away,
                "kickoff_at": item.kickoff_at,
                "model_version": payload.get("model_version") or MODEL_VERSION,
                "probabilities": {
                    "home": payload.get("home_win_probability"),
                    "draw": payload.get("draw_probability"),
                    "away": payload.get("away_win_probability"),
                },
                "expected_goals": {
                    "home": payload.get("expected_home_goals"),
                    "away": payload.get("expected_away_goals"),
                },
                "probable_score": None
                if not payload
                else f"{payload.get('predicted_home_goals')}-{payload.get('predicted_away_goals')}",
                "access_tier": item.access_tier,
                "action": item.action,
                "reason": item.reason,
            }
        )
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        limit = validate_limit(args.limit)
        settings = load_settings()
        reader = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        history = fetch_history(reader)
        upcoming = fetch_upcoming(reader, limit, args.fixture_id)
        existing = fetch_existing_predictions(reader, [int(row["api_football_fixture_id"]) for row in upcoming if row.get("api_football_fixture_id") is not None])
        plan = build_plan(history, upcoming, existing, limit=limit, free_count=args.free_count, allow_update=args.allow_update, min_history=args.min_history)
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        return 1

    if not plan:
        print(json.dumps({"ok": True, "status": "PENDIENTE FUENTE REAL", "message": "no hay fixtures proximos disponibles para publicar predicciones V1", "history_matches": len(history), "upcoming_matches": len(upcoming), "api_football_quota_used": 0}, ensure_ascii=False, indent=2))
        return 0

    if args.dry_run:
        print(json.dumps({"ok": True, "mode": "dry-run", "model_version": MODEL_VERSION, "history_matches": len(history), "items": plan_to_dict(plan), "api_football_quota_used": 0}, ensure_ascii=False, indent=2))
        return 0

    writable = [item for item in plan if item.action in {"insert", "update"}]
    if not writable:
        print(json.dumps({"ok": False, "error": "--apply bloqueado: no hay predicciones validas para escribir", "items": plan_to_dict(plan)}, ensure_ascii=False, indent=2))
        return 1

    writer = PredictionWriteClient(settings.supabase_url, settings.supabase_service_role_key)
    summary = apply_plan(plan, writer)
    print(json.dumps({"ok": summary.errors == 0, "mode": "apply", "summary": summary.__dict__, "items": plan_to_dict(plan)}, ensure_ascii=False, indent=2))
    return 0 if summary.errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

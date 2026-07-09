from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from .poisson_elo import parse_date
from .supabase_client import SupabaseRestClient
from .team_normalization import NORMALIZATION_VERSION


def stable_checksum(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def build_dataset_metadata(
    name: str,
    matches: list[dict[str, Any]],
    valid_matches: list[dict[str, Any]],
    discarded: list[dict[str, Any]],
    source_type: str = "supabase",
    source_name: str | None = None,
    status: str = "validated",
    description: str | None = None,
) -> dict[str, Any]:
    dates = []
    for match in valid_matches:
        try:
            dates.append(parse_date(match.get("fecha_orden")))
        except Exception:
            continue
    tournaments = sorted({str(match.get("torneo")) for match in valid_matches if match.get("torneo")})
    seasons = sorted({int(match.get("temporada")) for match in valid_matches if str(match.get("temporada") or "").isdigit()})
    return {
        "name": name,
        "description": description,
        "source_type": source_type,
        "source_name": source_name,
        "season": seasons[0] if len(seasons) == 1 else None,
        "competition": tournaments[0] if len(tournaments) == 1 else None,
        "date_from": min(dates).isoformat() if dates else None,
        "date_to": max(dates).isoformat() if dates else None,
        "total_matches": len(matches),
        "finished_matches": sum(1 for match in matches if match.get("estado") == "finalizado"),
        "valid_matches": len(valid_matches),
        "discarded_matches": len(discarded),
        "cleaning_criteria": {
            "requires_finished_score": True,
            "requires_distinct_teams": True,
            "requires_valid_date": True,
        },
        "team_normalization_version": NORMALIZATION_VERSION,
        "checksum": stable_checksum(
            [
                {
                    "id": match.get("id"),
                    "fecha_orden": match.get("fecha_orden"),
                    "torneo": match.get("torneo"),
                    "local": match.get("local_nombre"),
                    "visitante": match.get("visitante_nombre"),
                    "gl": match.get("goles_local_final"),
                    "gv": match.get("goles_visitante_final"),
                }
                for match in valid_matches
            ]
        ),
        "status": status,
        "quality_summary": {
            "tournaments": tournaments,
            "seasons": seasons,
            "valid_ratio": round(len(valid_matches) / len(matches), 6) if matches else 0,
        },
        "warnings": [] if len(valid_matches) >= 30 else ["Dataset con pocos partidos validos."],
        "metadata": {"created_by": "prediction-service"},
    }


def insert_dataset(client: SupabaseRestClient, dataset: dict[str, Any]) -> dict[str, Any] | None:
    try:
        if dataset.get("checksum"):
            rows = client.upsert("model_datasets", [dataset], on_conflict="checksum")
            return rows[0] if rows else dataset
        return client.insert("model_datasets", dataset)
    except Exception as error:  # noqa: BLE001
        print(f"Aviso: no se pudo registrar model_datasets: {error}")
        return None


def insert_model_run(client: SupabaseRestClient, run: dict[str, Any]) -> dict[str, Any] | None:
    try:
        return client.insert("model_runs", run)
    except Exception as error:  # noqa: BLE001
        print(f"Aviso: no se pudo registrar model_runs: {error}")
        return None


def build_run_payload(
    model_version: str,
    run_type: str,
    status: str,
    available_matches: int,
    used_matches: int,
    discarded_matches: int,
    dataset_id: str | None = None,
    metrics: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
    model_config: dict[str, Any] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    tournaments: list[str] | None = None,
    error_detail: str | None = None,
    admin_notes: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "model_version": model_version,
        "run_type": run_type,
        "status": status,
        "started_at": now,
        "finished_at": now if status in {"completed", "failed", "cancelled"} else None,
        "dataset_id": dataset_id,
        "date_from": date_from,
        "date_to": date_to,
        "tournaments": tournaments or [],
        "available_matches": available_matches,
        "used_matches": used_matches,
        "discarded_matches": discarded_matches,
        "model_config": model_config or {},
        "metrics": metrics or {},
        "warnings": warnings or [],
        "error_detail": error_detail,
        "config_hash": stable_checksum(model_config or {}),
        "admin_notes": admin_notes,
    }

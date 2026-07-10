from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
sys.path.insert(0, str(ROOT / "prediction-service"))

from predigol_model.poisson_elo import MODEL_VERSION, PoissonEloModel, parse_date
from predigol_model.traceability import stable_checksum
from predigol_model.v2 import MODEL_VERSION_V2, PoissonEloFormModel


MODEL_REGISTRY = {
    "v1": (PoissonEloModel, MODEL_VERSION, "production"),
    "v2": (PoissonEloFormModel, MODEL_VERSION_V2, "experimental"),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generar pronosticos PrediGol desde un dataset local.")
    parser.add_argument("--dataset", required=True, help="Dataset JSON local generado por importacion API/manual.")
    parser.add_argument("--model", choices=sorted(MODEL_REGISTRY), default="v1", help="Modelo a usar. Default: v1 produccion.")
    parser.add_argument("--league-id", help="Filtra por league_id del dataset si aplica.")
    parser.add_argument("--season", type=int, help="Filtra por temporada.")
    parser.add_argument("--min-training", type=int, default=30)
    parser.add_argument("--free-limit", type=int, default=10, help="Cantidad inicial marcada como gratis en la salida local.")
    parser.add_argument("--output", help="Ruta JSON de salida. Default: reports/pronosticos_<dataset>_<model>.json")
    parser.add_argument("--force", action="store_true", help="Sobrescribe la salida si ya existe.")
    return parser


def load_dataset(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    matches = payload.get("matches", []) if isinstance(payload, dict) else payload
    if not isinstance(matches, list):
        raise ValueError("El dataset debe ser una lista o un objeto con clave matches.")
    metadata = payload if isinstance(payload, dict) else {"name": path.stem}
    return metadata, [dict(match) for match in matches]


def default_output_path(dataset_path: Path, model_key: str) -> Path:
    return REPORTS / f"pronosticos_{dataset_path.stem}_{model_key}.json"


def outcome_from_probabilities(probabilities: dict[str, float]) -> str:
    labels = {"home": "local", "draw": "empate", "away": "visitante"}
    winner = max(["home", "draw", "away"], key=probabilities.get)
    return labels[winner]


def prediction_record(
    prediction: Any,
    match: dict[str, Any],
    model_version: str,
    model_status: str,
    dataset_metadata: dict[str, Any],
    access_tier: str,
) -> dict[str, Any]:
    probabilities = {
        "home": round(float(prediction.home_win_probability), 6),
        "draw": round(float(prediction.draw_probability), 6),
        "away": round(float(prediction.away_win_probability), 6),
    }
    return {
        "match_id": match.get("id"),
        "api_football_fixture_id": match.get("api_football_fixture_id"),
        "league_id": dataset_metadata.get("league_id") or match.get("api_football_league_id"),
        "season": dataset_metadata.get("season") or match.get("temporada"),
        "league": match.get("torneo"),
        "match_date": match.get("fecha_orden"),
        "home_team": match.get("local_nombre"),
        "away_team": match.get("visitante_nombre"),
        "model_name": "PrediGol V1" if model_version == MODEL_VERSION else "PrediGol V2",
        "model_version": model_version,
        "model_status": model_status,
        "model_config": {},
        "p_home": probabilities["home"],
        "p_draw": probabilities["draw"],
        "p_away": probabilities["away"],
        "predicted_outcome": outcome_from_probabilities(probabilities),
        "expected_home_goals": round(float(prediction.expected_home_goals), 3),
        "expected_away_goals": round(float(prediction.expected_away_goals), 3),
        "probable_score": f"{prediction.predicted_home_goals}-{prediction.predicted_away_goals}",
        "predicted_home_goals": prediction.predicted_home_goals,
        "predicted_away_goals": prediction.predicted_away_goals,
        "confidence": round(float(prediction.confidence), 6),
        "access_tier": access_tier,
        "premium_note": "Marcado solo para planificacion freemium; la seguridad premium real debe validarse server-side.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_dataset": dataset_metadata.get("name"),
        "source_dataset_file": dataset_metadata.get("file"),
        "source_dataset_checksum": dataset_metadata.get("checksum"),
        "metadata": prediction.metadata,
    }


def generate_predictions(
    dataset_metadata: dict[str, Any],
    matches: list[dict[str, Any]],
    model_key: str = "v1",
    min_training: int = 30,
    league_id: str | None = None,
    season: int | None = None,
    free_limit: int = 10,
) -> dict[str, Any]:
    model_class, model_version, model_status = MODEL_REGISTRY[model_key]
    filtered = [
        match for match in matches
        if (season is None or int(match.get("temporada") or dataset_metadata.get("season") or 0) == season)
        and (league_id is None or str(match.get("api_football_league_id") or dataset_metadata.get("league_id") or "") == str(league_id))
    ]
    finished = [
        match for match in filtered
        if match.get("estado") == "finalizado"
        and match.get("goles_local_final") is not None
        and match.get("goles_visitante_final") is not None
    ]
    ordered = sorted(finished, key=lambda match: parse_date(match.get("fecha_orden")))
    predictions = []
    errors = []
    dataset_metadata = {**dataset_metadata, "file": dataset_metadata.get("file")}

    for index, match in enumerate(ordered):
        if index < min_training:
            continue
        try:
            model = model_class(ordered[:index])
            prediction = model.predict(match)
            access_tier = "free" if len(predictions) < free_limit else "premium_candidate"
            predictions.append(prediction_record(prediction, match, model_version, model_status, dataset_metadata, access_tier))
        except Exception as error:  # noqa: BLE001
            errors.append({"match_id": match.get("id"), "error": str(error)})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "key": model_key,
            "version": model_version,
            "status": model_status,
            "production_note": "V1 es el modelo principal de produccion. V2 solo es experimental.",
        },
        "dataset": {
            "name": dataset_metadata.get("name"),
            "provider": dataset_metadata.get("provider"),
            "league_id": dataset_metadata.get("league_id"),
            "season": dataset_metadata.get("season"),
            "checksum": dataset_metadata.get("checksum"),
        },
        "summary": {
            "matches_in_dataset": len(matches),
            "matches_after_filters": len(filtered),
            "finished_matches_used": len(ordered),
            "min_training": min_training,
            "matches_processed": max(len(ordered) - min_training, 0),
            "predictions_generated": len(predictions),
            "errors": len(errors),
            "free_predictions": sum(1 for item in predictions if item["access_tier"] == "free"),
            "premium_candidates": sum(1 for item in predictions if item["access_tier"] == "premium_candidate"),
        },
        "traceability": {
            "source_dataset_checksum": dataset_metadata.get("checksum"),
            "prediction_checksum": stable_checksum(predictions),
        },
        "predictions": predictions,
        "errors": errors,
    }


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"ERROR: dataset no encontrado: {dataset_path}")
        return 1

    output_path = Path(args.output) if args.output else default_output_path(dataset_path, args.model)
    if output_path.exists() and not args.force:
        print(f"OMITIDO: la salida ya existe: {output_path}. Usa --force para regenerar.")
        return 0

    try:
        metadata, matches = load_dataset(dataset_path)
        result = generate_predictions(
            metadata,
            matches,
            model_key=args.model,
            min_training=args.min_training,
            league_id=args.league_id,
            season=args.season,
            free_limit=args.free_limit,
        )
        output_path.parent.mkdir(exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: no fue posible generar pronosticos: {error}")
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "model": result["model"],
                "summary": result["summary"],
                "output": str(output_path),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

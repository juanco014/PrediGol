from __future__ import annotations

import csv
import json
import math
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .data_quality import DataQualityThresholds, build_data_quality_report
from .evaluation import OUTCOMES, match_outcome
from .poisson_elo import MODEL_VERSION, PoissonEloModel, parse_date
from .v2 import MODEL_VERSION_V2, PoissonEloFormModel, V2Config


def _probs(prediction: Any) -> dict[str, float]:
    probabilities = {
        "home": prediction.home_win_probability,
        "draw": prediction.draw_probability,
        "away": prediction.away_win_probability,
    }
    total = sum(probabilities.values())
    if any(value < -1e-9 or value > 1 + 1e-9 or not math.isfinite(value) for value in probabilities.values()):
        raise ValueError("Probabilidades 1X2 invalidas.")
    if abs(total - 1.0) > 1e-6:
        raise ValueError(f"Probabilidades 1X2 no suman 1: {total}.")
    return probabilities


def _score_prediction(model_version: str, prediction: Any, match: dict[str, Any], elapsed_ms: float, training_count: int) -> dict[str, Any]:
    home_goals = int(match["goles_local_final"])
    away_goals = int(match["goles_visitante_final"])
    actual_outcome = match_outcome(home_goals, away_goals)
    probabilities = _probs(prediction)
    predicted_outcome = max(OUTCOMES, key=probabilities.get)
    brier = sum((probabilities[outcome] - (1.0 if outcome == actual_outcome else 0.0)) ** 2 for outcome in OUTCOMES)
    return {
        "match_id": match.get("id"),
        "fecha_orden": match.get("fecha_orden"),
        "torneo": match.get("torneo") or "Sin torneo",
        "temporada": match.get("temporada"),
        "local": match.get("local_nombre"),
        "visitante": match.get("visitante_nombre"),
        "model_version": model_version,
        "probabilities": {key: round(value, 6) for key, value in probabilities.items()},
        "probabilities_uncalibrated": prediction.metadata.get("raw_probabilities"),
        "probabilities_calibrated": probabilities if prediction.metadata.get("calibration_active") else None,
        "expected_home_goals": round(prediction.expected_home_goals, 3),
        "expected_away_goals": round(prediction.expected_away_goals, 3),
        "predicted_score": f"{prediction.predicted_home_goals}-{prediction.predicted_away_goals}",
        "actual_score": f"{home_goals}-{away_goals}",
        "actual_outcome": actual_outcome,
        "predicted_outcome": predicted_outcome,
        "outcome_hit": predicted_outcome == actual_outcome,
        "exact_score_hit": prediction.predicted_home_goals == home_goals and prediction.predicted_away_goals == away_goals,
        "brier_score": brier,
        "log_loss": -math.log(max(probabilities[actual_outcome], 1e-12)),
        "home_goals_absolute_error": abs(prediction.expected_home_goals - home_goals),
        "away_goals_absolute_error": abs(prediction.expected_away_goals - away_goals),
        "data_quality": {
            "training_matches_before_match": training_count,
            "home_samples": prediction.metadata.get("home_samples"),
            "away_samples": prediction.metadata.get("away_samples"),
            "league_matches": prediction.metadata.get("league_matches"),
        },
        "warnings": prediction.metadata.get("warnings", []),
        "elapsed_ms": round(elapsed_ms, 3),
    }


def _aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {"matches": 0}
    dates = sorted(row["fecha_orden"] for row in rows if row.get("fecha_orden"))
    return {
        "matches": len(rows),
        "brier_score": round(sum(row["brier_score"] for row in rows) / len(rows), 6),
        "log_loss": round(sum(row["log_loss"] for row in rows) / len(rows), 6),
        "home_goals_mae": round(sum(row["home_goals_absolute_error"] for row in rows) / len(rows), 6),
        "away_goals_mae": round(sum(row["away_goals_absolute_error"] for row in rows) / len(rows), 6),
        "goals_mae": round(
            sum(row["home_goals_absolute_error"] + row["away_goals_absolute_error"] for row in rows) / (len(rows) * 2),
            6,
        ),
        "outcome_accuracy": round(sum(1 for row in rows if row["outcome_hit"]) / len(rows), 6),
        "exact_score_accuracy": round(sum(1 for row in rows if row["exact_score_hit"]) / len(rows), 6),
        "evaluation_date_from": dates[0] if dates else None,
        "evaluation_date_to": dates[-1] if dates else None,
        "calibration": _calibration_bins(rows),
    }


def _calibration_bins(rows: list[dict[str, Any]], bins: int = 5) -> list[dict[str, Any]]:
    buckets: list[list[dict[str, Any]]] = [[] for _ in range(bins)]
    for row in rows:
        confidence = max(float(value) for value in row["probabilities"].values())
        index = min(bins - 1, int(confidence * bins))
        buckets[index].append(row)
    result: list[dict[str, Any]] = []
    for index, bucket in enumerate(buckets):
        lower = index / bins
        upper = (index + 1) / bins
        if not bucket:
            result.append({"bin": f"{lower:.1f}-{upper:.1f}", "matches": 0})
            continue
        avg_confidence = sum(max(float(value) for value in row["probabilities"].values()) for row in bucket) / len(bucket)
        accuracy = sum(1 for row in bucket if row["outcome_hit"]) / len(bucket)
        result.append(
            {
                "bin": f"{lower:.1f}-{upper:.1f}",
                "matches": len(bucket),
                "avg_confidence": round(avg_confidence, 6),
                "accuracy": round(accuracy, 6),
                "calibration_error": round(abs(avg_confidence - accuracy), 6),
            }
        )
    return result


def _interpret(v1: dict[str, Any], v2: dict[str, Any], evaluated: int) -> str:
    if evaluated < 30:
        return "No existe evidencia suficiente para concluir que V2 supera a V1; la muestra evaluada es pequena."
    if v1.get("matches") != v2.get("matches"):
        return "La comparacion no es valida si los modelos no evaluaron exactamente el mismo conjunto de partidos."
    if v2.get("brier_score", 99) < v1.get("brier_score", 99) and v2.get("log_loss", 99) < v1.get("log_loss", 99):
        return "V2 muestra una diferencia preliminar en este conjunto de datos, pero se requieren mas partidos y estabilidad por torneo/temporada antes de considerarlo superior."
    return "No existe evidencia suficiente para concluir que V2 supera a V1."


def compare_v1_v2(
    history: list[dict[str, Any]],
    min_training_matches: int = 30,
    date_from: str | None = None,
    date_to: str | None = None,
    tournaments: list[str] | None = None,
    season: int | None = None,
    v2_config: V2Config | None = None,
    pending_aliases: int = 0,
    thresholds: DataQualityThresholds | None = None,
) -> dict[str, Any]:
    ordered = sorted(history, key=lambda match: parse_date(match.get("fecha_orden")))
    tournament_set = {item.casefold() for item in tournaments or []}
    excluded: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []

    for index, match in enumerate(ordered):
        match_date = parse_date(match.get("fecha_orden"))
        if index < min_training_matches:
            excluded.append({"match_id": match.get("id"), "reason": "min_training_matches"})
            continue
        if date_from and match_date < parse_date(date_from):
            excluded.append({"match_id": match.get("id"), "reason": "before_date_from"})
            continue
        if date_to and match_date > parse_date(date_to):
            excluded.append({"match_id": match.get("id"), "reason": "after_date_to"})
            continue
        if tournament_set and str(match.get("torneo") or "").casefold() not in tournament_set:
            excluded.append({"match_id": match.get("id"), "reason": "tournament_filter"})
            continue
        if season is not None and int(match.get("temporada") or 0) != season:
            excluded.append({"match_id": match.get("id"), "reason": "season_filter"})
            continue

        training = ordered[:index]
        for model_version, model in [
            (MODEL_VERSION, PoissonEloModel(training)),
            (MODEL_VERSION_V2, PoissonEloFormModel(training, v2_config)),
        ]:
            started = time.perf_counter()
            prediction = model.predict(match)
            rows.append(_score_prediction(model_version, prediction, match, (time.perf_counter() - started) * 1000, len(training)))

    by_model = defaultdict(list)
    for row in rows:
        by_model[row["model_version"]].append(row)

    v1_rows = by_model[MODEL_VERSION]
    v2_rows = by_model[MODEL_VERSION_V2]
    v1_match_ids = {row["match_id"] for row in v1_rows}
    v2_match_ids = {row["match_id"] for row in v2_rows}
    same_evaluation_set = v1_match_ids == v2_match_ids
    v1_summary = _aggregate(v1_rows)
    v2_summary = _aggregate(v2_rows)
    paired = defaultdict(dict)
    for row in rows:
        paired[row["match_id"]][row["model_version"]] = row
    data_quality = build_data_quality_report(
        ordered,
        pending_aliases=pending_aliases,
        discarded_matches=len(excluded),
        thresholds=thresholds,
        evaluated_matches=len(paired),
        same_evaluation_set=same_evaluation_set,
    )

    v1_better = []
    v2_better = []
    for pair in paired.values():
        if MODEL_VERSION in pair and MODEL_VERSION_V2 in pair:
            delta = pair[MODEL_VERSION]["brier_score"] - pair[MODEL_VERSION_V2]["brier_score"]
            target = v2_better if delta > 0 else v1_better if delta < 0 else None
            if target is not None:
                target.append({"match_id": pair[MODEL_VERSION]["match_id"], "brier_delta_v1_minus_v2": round(delta, 6)})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "models": [MODEL_VERSION, MODEL_VERSION_V2],
        "config": {
            "min_training_matches": min_training_matches,
            "date_from": date_from,
            "date_to": date_to,
            "tournaments": tournaments or [],
            "season": season,
            "v2": v2_config.__dict__ if v2_config else V2Config().__dict__,
        },
        "evaluated_matches": len(paired),
        "same_evaluation_set": same_evaluation_set,
        "summaries": {MODEL_VERSION: v1_summary, MODEL_VERSION_V2: v2_summary},
        "data_quality": data_quality,
        "by_tournament": {
            tournament: {
                model: _aggregate([row for row in model_rows if row["torneo"] == tournament])
                for model, model_rows in by_model.items()
            }
            for tournament in sorted({row["torneo"] for row in rows})
        },
        "by_season": {
            str(season_key): {
                model: _aggregate([row for row in model_rows if row.get("temporada") == season_key])
                for model, model_rows in by_model.items()
            }
            for season_key in sorted({row.get("temporada") for row in rows if row.get("temporada") is not None})
        },
        "v1_better_examples": sorted(v1_better, key=lambda item: item["brier_delta_v1_minus_v2"])[:12],
        "v2_better_examples": sorted(v2_better, key=lambda item: item["brier_delta_v1_minus_v2"], reverse=True)[:12],
        "excluded_matches": excluded[:200],
        "interpretation": _interpret(v1_summary, v2_summary, len(paired)),
        "rows": rows,
    }


def write_comparison_reports(result: dict[str, Any], reports_dir: Path, prefix: str = "backtest_v1_v2") -> dict[str, str]:
    reports_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = reports_dir / f"{prefix}_{stamp}.json"
    csv_path = reports_dir / f"{prefix}_{stamp}.csv"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    fieldnames = [
        "match_id",
        "fecha_orden",
        "torneo",
        "temporada",
        "local",
        "visitante",
        "model_version",
        "predicted_score",
        "actual_score",
        "predicted_outcome",
        "actual_outcome",
        "probabilities",
        "probabilities_uncalibrated",
        "probabilities_calibrated",
        "outcome_hit",
        "exact_score_hit",
        "brier_score",
        "log_loss",
        "home_goals_absolute_error",
        "away_goals_absolute_error",
        "elapsed_ms",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in result["rows"]:
            writer.writerow({key: row.get(key) for key in fieldnames})

    return {"json": str(json_path), "csv": str(csv_path)}

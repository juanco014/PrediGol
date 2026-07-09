from __future__ import annotations

import csv
import json
import math
import time
from collections import defaultdict
from dataclasses import replace
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
    predicted_outcome = prediction.metadata.get("predicted_outcome") or max(OUTCOMES, key=probabilities.get)
    if predicted_outcome not in OUTCOMES:
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


def _outcome_counts(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    return {outcome: sum(1 for row in rows if row.get(key) == outcome) for outcome in OUTCOMES}


def _safe_rate(numerator: int | float, denominator: int | float) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 6)


def _score_from_text(value: str) -> tuple[int, int]:
    home, away = str(value).split("-", 1)
    return int(home), int(away)


def _simulate_draw_margin(rows: list[dict[str, Any]], margin: float, baseline_accuracy: float) -> dict[str, Any]:
    predicted_counts = {outcome: 0 for outcome in OUTCOMES}
    hits = 0
    draw_hits = 0
    false_draws = 0

    for row in rows:
        probabilities = row["probabilities"]
        base_outcome = max(OUTCOMES, key=probabilities.get)
        max_probability = probabilities[base_outcome]
        predicted = "draw" if probabilities["draw"] >= max_probability - margin else base_outcome
        actual = row["actual_outcome"]

        predicted_counts[predicted] += 1
        hits += int(predicted == actual)
        draw_hits += int(predicted == "draw" and actual == "draw")
        false_draws += int(predicted == "draw" and actual != "draw")

    accuracy = hits / len(rows) if rows else 0.0
    return {
        "margin": margin,
        "accuracy": round(accuracy, 6),
        "accuracy_delta_vs_baseline": round(accuracy - baseline_accuracy, 6),
        "predicted_draws": predicted_counts["draw"],
        "draw_hits": draw_hits,
        "false_draws": false_draws,
        "predicted_home": predicted_counts["home"],
        "predicted_away": predicted_counts["away"],
    }


def _experiment_5_configs(base_config: V2Config) -> list[dict[str, Any]]:
    configs: list[dict[str, Any]] = []
    for value in [1.00, 0.95, 0.90, 0.85]:
        configs.append(
            {
                "label": f"home_xg_multiplier={value:.2f}",
                "config": replace(
                    base_config,
                    enable_home_bias_adjustment=True,
                    home_bias_multiplier=1.0,
                    home_xg_multiplier=value,
                    away_xg_multiplier=1.0,
                ),
                "parameters": {
                    "enable_home_bias_adjustment": True,
                    "home_bias_multiplier": 1.0,
                    "home_xg_multiplier": value,
                    "away_xg_multiplier": 1.0,
                },
            }
        )
    for value in [1.00, 0.95, 0.90, 0.85]:
        configs.append(
            {
                "label": f"home_bias_multiplier={value:.2f}",
                "config": replace(
                    base_config,
                    enable_home_bias_adjustment=True,
                    home_bias_multiplier=value,
                    home_xg_multiplier=1.0,
                    away_xg_multiplier=1.0,
                ),
                "parameters": {
                    "enable_home_bias_adjustment": True,
                    "home_bias_multiplier": value,
                    "home_xg_multiplier": 1.0,
                    "away_xg_multiplier": 1.0,
                },
            }
        )
    return configs


def _experiment_6_configs(base_config: V2Config) -> list[dict[str, Any]]:
    configs: list[dict[str, Any]] = []
    for value in [1.00, 1.05, 1.10, 1.15, 1.20, 1.30]:
        configs.append(
            {
                "label": f"home_xg=0.90_draw_multiplier={value:.2f}",
                "config": replace(
                    base_config,
                    enable_home_bias_adjustment=True,
                    home_bias_multiplier=1.0,
                    home_xg_multiplier=0.90,
                    away_xg_multiplier=1.0,
                    enable_draw_probability_adjustment=True,
                    draw_probability_multiplier=value,
                ),
                "parameters": {
                    "enable_home_bias_adjustment": True,
                    "home_bias_multiplier": 1.0,
                    "home_xg_multiplier": 0.90,
                    "away_xg_multiplier": 1.0,
                    "enable_draw_probability_adjustment": True,
                    "draw_probability_multiplier": value,
                },
            }
        )
    return configs


def _experiment_5_summary(rows: list[dict[str, Any]], config: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    summary = _aggregate(rows)
    matches = len(rows)
    actual_home_wins = sum(1 for row in rows if row["actual_outcome"] == "home")
    predicted_home = sum(1 for row in rows if row["predicted_outcome"] == "home")
    true_predicted_home = sum(1 for row in rows if row["predicted_outcome"] == "home" and row["actual_outcome"] == "home")
    actual_home_goals = []
    actual_away_goals = []
    for row in rows:
        home_goals, away_goals = _score_from_text(row["actual_score"])
        actual_home_goals.append(home_goals)
        actual_away_goals.append(away_goals)

    expected_home = [row["expected_home_goals"] for row in rows]
    expected_away = [row["expected_away_goals"] for row in rows]
    return {
        "label": config["label"],
        "parameters": config["parameters"],
        "accuracy": summary.get("outcome_accuracy"),
        "accuracy_delta_vs_baseline": round(summary.get("outcome_accuracy", 0.0) - baseline.get("outcome_accuracy", 0.0), 6),
        "brier_score": summary.get("brier_score"),
        "brier_delta_vs_baseline": round(summary.get("brier_score", 0.0) - baseline.get("brier_score", 0.0), 6),
        "log_loss": summary.get("log_loss"),
        "log_loss_delta_vs_baseline": round(summary.get("log_loss", 0.0) - baseline.get("log_loss", 0.0), 6),
        "argmax_distribution": {
            outcome: sum(1 for row in rows if max(OUTCOMES, key=row["probabilities"].get) == outcome)
            for outcome in OUTCOMES
        },
        "predicted_outcome_distribution": _outcome_counts(rows, "predicted_outcome"),
        "predicted_home": predicted_home,
        "precision_when_predicting_home": _safe_rate(true_predicted_home, predicted_home),
        "recall_home_wins": _safe_rate(true_predicted_home, actual_home_wins),
        "false_home_predictions": predicted_home - true_predicted_home,
        "expected_home_goals_mean": round(sum(expected_home) / matches, 6) if rows else None,
        "expected_away_goals_mean": round(sum(expected_away) / matches, 6) if rows else None,
        "expected_total_goals_mean": round(sum(h + a for h, a in zip(expected_home, expected_away)) / matches, 6) if rows else None,
        "home_xg_error_mean": round(sum(xg - actual for xg, actual in zip(expected_home, actual_home_goals)) / matches, 6) if rows else None,
        "away_xg_error_mean": round(sum(xg - actual for xg, actual in zip(expected_away, actual_away_goals)) / matches, 6) if rows else None,
        "total_xg_error_mean": round(
            sum((eh + ea) - (ah + aa) for eh, ea, ah, aa in zip(expected_home, expected_away, actual_home_goals, actual_away_goals)) / matches,
            6,
        ) if rows else None,
    }


def _experiment_6_summary(rows: list[dict[str, Any]], config: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    result = _experiment_5_summary(rows, config, baseline)
    predicted_draws = sum(1 for row in rows if row["predicted_outcome"] == "draw")
    actual_draws = sum(1 for row in rows if row["actual_outcome"] == "draw")
    draw_hits = sum(1 for row in rows if row["predicted_outcome"] == "draw" and row["actual_outcome"] == "draw")
    false_draws = sum(1 for row in rows if row["predicted_outcome"] == "draw" and row["actual_outcome"] != "draw")
    result.update(
        {
            "predicted_draws": predicted_draws,
            "draw_hits": draw_hits,
            "false_draws": false_draws,
            "precision_when_predicting_draw": _safe_rate(draw_hits, predicted_draws),
            "recall_real_draws": _safe_rate(draw_hits, actual_draws),
        }
    )
    return result


def _v2_diagnostics(
    rows: list[dict[str, Any]],
    experiment_5_rows: dict[str, list[dict[str, Any]]] | None = None,
    experiment_5_configs: list[dict[str, Any]] | None = None,
    experiment_6_rows: dict[str, list[dict[str, Any]]] | None = None,
    experiment_6_configs: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not rows:
        return {"matches": 0}

    matches = len(rows)
    probabilities_by_actual = {
        outcome: [row["probabilities"] for row in rows if row["actual_outcome"] == outcome]
        for outcome in OUTCOMES
    }
    draw_gap_thresholds = [0.01, 0.03, 0.05, 0.08, 0.10, 0.15]
    home_dominance_thresholds = [0.05, 0.10, 0.15, 0.20]
    baseline_accuracy = sum(1 for row in rows if row["outcome_hit"]) / matches
    actual_home_wins = sum(1 for row in rows if row["actual_outcome"] == "home")
    predicted_home = sum(1 for row in rows if row["predicted_outcome"] == "home")
    true_predicted_home = sum(1 for row in rows if row["predicted_outcome"] == "home" and row["actual_outcome"] == "home")

    actual_home_goals = []
    actual_away_goals = []
    expected_home_goals = []
    expected_away_goals = []
    for row in rows:
        home_goals, away_goals = _score_from_text(row["actual_score"])
        actual_home_goals.append(home_goals)
        actual_away_goals.append(away_goals)
        expected_home_goals.append(row["expected_home_goals"])
        expected_away_goals.append(row["expected_away_goals"])

    draw_margin_sweep = [0.00, 0.03, 0.05, 0.08, 0.10, 0.12, 0.15]
    diagnostics = {
        "matches": matches,
        "average_probabilities": {
            outcome: round(sum(row["probabilities"][outcome] for row in rows) / matches, 6)
            for outcome in OUTCOMES
        },
        "average_probabilities_by_actual_outcome": {
            actual: {
                outcome: round(sum(item[outcome] for item in probabilities) / len(probabilities), 6)
                for outcome in OUTCOMES
            }
            for actual, probabilities in probabilities_by_actual.items()
            if probabilities
        },
        "argmax_distribution": {
            outcome: sum(1 for row in rows if max(OUTCOMES, key=row["probabilities"].get) == outcome)
            for outcome in OUTCOMES
        },
        "predicted_outcome_distribution": _outcome_counts(rows, "predicted_outcome"),
        "actual_outcome_distribution": _outcome_counts(rows, "actual_outcome"),
        "average_margins_vs_draw": {
            "home_minus_draw": round(sum(row["probabilities"]["home"] - row["probabilities"]["draw"] for row in rows) / matches, 6),
            "away_minus_draw": round(sum(row["probabilities"]["away"] - row["probabilities"]["draw"] for row in rows) / matches, 6),
        },
        "draw_within_max_margin_counts": {
            f"{threshold:.2f}": sum(
                1 for row in rows if max(row["probabilities"].values()) - row["probabilities"]["draw"] <= threshold
            )
            for threshold in draw_gap_thresholds
        },
        "draw_decision_margin_sweep": [
            _simulate_draw_margin(rows, margin, baseline_accuracy) for margin in draw_margin_sweep
        ],
        "home_bias": {
            "actual_home_wins": actual_home_wins,
            "predicted_home": predicted_home,
            "precision_when_predicting_home": _safe_rate(true_predicted_home, predicted_home),
            "recall_home_wins": _safe_rate(true_predicted_home, actual_home_wins),
            "false_home_predictions": predicted_home - true_predicted_home,
            "home_dominance_counts": {
                f"{threshold:.2f}": sum(
                    1
                    for row in rows
                    if row["probabilities"]["home"] - max(row["probabilities"]["draw"], row["probabilities"]["away"]) > threshold
                )
                for threshold in home_dominance_thresholds
            },
        },
        "xg": {
            "expected_home_goals_mean": round(sum(expected_home_goals) / matches, 6),
            "expected_away_goals_mean": round(sum(expected_away_goals) / matches, 6),
            "expected_total_goals_mean": round(sum(h + a for h, a in zip(expected_home_goals, expected_away_goals)) / matches, 6),
            "actual_home_goals_mean": round(sum(actual_home_goals) / matches, 6),
            "actual_away_goals_mean": round(sum(actual_away_goals) / matches, 6),
            "actual_total_goals_mean": round(sum(h + a for h, a in zip(actual_home_goals, actual_away_goals)) / matches, 6),
            "home_xg_error_mean": round(sum(xg - actual for xg, actual in zip(expected_home_goals, actual_home_goals)) / matches, 6),
            "away_xg_error_mean": round(sum(xg - actual for xg, actual in zip(expected_away_goals, actual_away_goals)) / matches, 6),
            "total_xg_error_mean": round(
                sum((eh + ea) - (ah + aa) for eh, ea, ah, aa in zip(expected_home_goals, expected_away_goals, actual_home_goals, actual_away_goals)) / matches,
                6,
            ),
        },
    }
    if experiment_5_rows is not None and experiment_5_configs is not None:
        baseline_summary = _aggregate(rows)
        diagnostics["experiment_5"] = [
            _experiment_5_summary(experiment_5_rows[item["label"]], item, baseline_summary)
            for item in experiment_5_configs
        ]
    if experiment_6_rows is not None and experiment_6_configs is not None:
        baseline_summary = _aggregate(rows)
        diagnostics["experiment_6"] = [
            _experiment_6_summary(experiment_6_rows[item["label"]], item, baseline_summary)
            for item in experiment_6_configs
        ]
    return diagnostics


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
    base_v2_config = v2_config or V2Config()
    experiment_5_configs = _experiment_5_configs(base_v2_config)
    experiment_5_rows: dict[str, list[dict[str, Any]]] = {item["label"]: [] for item in experiment_5_configs}
    experiment_6_configs = _experiment_6_configs(base_v2_config)
    experiment_6_rows: dict[str, list[dict[str, Any]]] = {item["label"]: [] for item in experiment_6_configs}

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
        for item in experiment_5_configs:
            started = time.perf_counter()
            prediction = PoissonEloFormModel(training, item["config"]).predict(match)
            row = _score_prediction(MODEL_VERSION_V2, prediction, match, (time.perf_counter() - started) * 1000, len(training))
            row["experiment_5_label"] = item["label"]
            experiment_5_rows[item["label"]].append(row)
        for item in experiment_6_configs:
            started = time.perf_counter()
            prediction = PoissonEloFormModel(training, item["config"]).predict(match)
            row = _score_prediction(MODEL_VERSION_V2, prediction, match, (time.perf_counter() - started) * 1000, len(training))
            row["experiment_6_label"] = item["label"]
            experiment_6_rows[item["label"]].append(row)

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
        "diagnostics": {"v2": _v2_diagnostics(v2_rows, experiment_5_rows, experiment_5_configs, experiment_6_rows, experiment_6_configs)},
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

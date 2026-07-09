from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from .poisson_elo import MODEL_VERSION, PoissonEloModel, parse_date

OUTCOMES = ("home", "draw", "away")


def match_outcome(home_goals: int, away_goals: int) -> str:
    if home_goals > away_goals:
        return "home"
    if home_goals < away_goals:
        return "away"
    return "draw"


def normalized_outcome_frequencies(matches: list[dict[str, Any]]) -> dict[str, float]:
    counts = Counter(
        match_outcome(
            int(match["goles_local_final"]),
            int(match["goles_visitante_final"]),
        )
        for match in matches
    )
    denominator = len(matches) + len(OUTCOMES)
    return {outcome: (counts[outcome] + 1) / denominator for outcome in OUTCOMES}


def _prediction_probabilities(prediction: Any) -> dict[str, float]:
    return {
        "home": prediction.home_win_probability,
        "draw": prediction.draw_probability,
        "away": prediction.away_win_probability,
    }


def _empty_metric_bucket() -> dict[str, Any]:
    return {
        "matches": 0,
        "outcome_hits": 0,
        "exact_hits": 0,
        "brier_total": 0.0,
        "log_loss_total": 0.0,
        "home_absolute_error": 0.0,
        "away_absolute_error": 0.0,
    }


def _add_metric_row(bucket: dict[str, Any], row: dict[str, Any]) -> None:
    bucket["matches"] += 1
    bucket["outcome_hits"] += int(row["predicted_outcome"] == row["actual_outcome"])
    bucket["exact_hits"] += int(row["exact_score_hit"])
    bucket["brier_total"] += row["brier_score"]
    bucket["log_loss_total"] += row["log_loss"]
    bucket["home_absolute_error"] += row["home_absolute_error"]
    bucket["away_absolute_error"] += row["away_absolute_error"]


def _finalize_metric_bucket(bucket: dict[str, Any]) -> dict[str, Any]:
    matches = bucket["matches"]
    if matches <= 0:
        return {"matches": 0}

    return {
        "matches": matches,
        "outcome_accuracy": round(bucket["outcome_hits"] / matches, 6),
        "exact_score_accuracy": round(bucket["exact_hits"] / matches, 6),
        "brier_score": round(bucket["brier_total"] / matches, 6),
        "log_loss": round(bucket["log_loss_total"] / matches, 6),
        "home_goals_mae": round(bucket["home_absolute_error"] / matches, 6),
        "away_goals_mae": round(bucket["away_absolute_error"] / matches, 6),
    }


def evaluate_temporal_holdout(
    history: list[dict[str, Any]],
    test_ratio: float = 0.2,
    min_training_matches: int = 30,
    min_test_matches: int = 10,
    model_class: type[Any] = PoissonEloModel,
    model_version: str = MODEL_VERSION,
    min_group_matches: int = 5,
) -> dict[str, Any]:
    if not 0.05 <= test_ratio <= 0.5:
        raise ValueError("test_ratio debe estar entre 0.05 y 0.5.")

    ordered = sorted(history, key=lambda match: parse_date(match.get("fecha_orden")))
    requested_test_size = max(min_test_matches, round(len(ordered) * test_ratio))
    test_size = min(requested_test_size, len(ordered) - min_training_matches)

    if test_size < min_test_matches:
        required = min_training_matches + min_test_matches
        raise ValueError(
            f"Se necesitan al menos {required} partidos para el backtest; hay {len(ordered)}."
        )

    split_index = len(ordered) - test_size
    test = ordered[split_index:]
    global_bucket = _empty_metric_bucket()
    baseline_hits = 0
    baseline_brier_total = 0.0
    tournament_buckets: dict[str, dict[str, Any]] = defaultdict(_empty_metric_bucket)
    season_buckets: dict[str, dict[str, Any]] = defaultdict(_empty_metric_bucket)
    examples: list[dict[str, Any]] = []
    baseline_reference = normalized_outcome_frequencies(ordered[:split_index])

    for index, match in enumerate(test, start=split_index):
        training = ordered[:index]
        model = model_class(training)
        baseline_probabilities = normalized_outcome_frequencies(training)
        baseline_choice = max(OUTCOMES, key=baseline_probabilities.get)
        prediction = model.predict(match)
        probabilities = _prediction_probabilities(prediction)
        predicted_outcome = prediction.metadata.get("predicted_outcome") or max(OUTCOMES, key=probabilities.get)
        if predicted_outcome not in OUTCOMES:
            predicted_outcome = max(OUTCOMES, key=probabilities.get)
        home_goals = int(match["goles_local_final"])
        away_goals = int(match["goles_visitante_final"])
        actual_outcome = match_outcome(home_goals, away_goals)
        brier_score = sum(
            (probabilities[outcome] - (1.0 if outcome == actual_outcome else 0.0)) ** 2
            for outcome in OUTCOMES
        )
        baseline_hits += int(baseline_choice == actual_outcome)
        baseline_brier_total += sum(
            (
                baseline_probabilities[outcome]
                - (1.0 if outcome == actual_outcome else 0.0)
            )
            ** 2
            for outcome in OUTCOMES
        )
        log_loss = -math.log(max(probabilities[actual_outcome], 1e-12))
        exact_score_hit = (
            prediction.predicted_home_goals == home_goals
            and prediction.predicted_away_goals == away_goals
        )

        row = {
            "match_id": match.get("id"),
            "fecha_orden": match.get("fecha_orden"),
            "torneo": str(match.get("torneo") or "Sin torneo"),
            "local": match.get("local_nombre"),
            "visitante": match.get("visitante_nombre"),
            "actual_score": f"{home_goals}-{away_goals}",
            "predicted_score": f"{prediction.predicted_home_goals}-{prediction.predicted_away_goals}",
            "actual_outcome": actual_outcome,
            "predicted_outcome": predicted_outcome,
            "probabilities": {key: round(value, 6) for key, value in probabilities.items()},
            "expected_home_goals": round(prediction.expected_home_goals, 3),
            "expected_away_goals": round(prediction.expected_away_goals, 3),
            "exact_score_hit": exact_score_hit,
            "brier_score": brier_score,
            "log_loss": log_loss,
            "home_absolute_error": abs(prediction.expected_home_goals - home_goals),
            "away_absolute_error": abs(prediction.expected_away_goals - away_goals),
            "training_matches": len(training),
        }

        _add_metric_row(global_bucket, row)
        _add_metric_row(tournament_buckets[row["torneo"]], row)
        season_key = str(parse_date(match.get("fecha_orden")).year)
        _add_metric_row(season_buckets[season_key], row)

        if exact_score_hit or predicted_outcome != actual_outcome:
            examples.append(row)

    total = len(test)
    baseline_brier_score = baseline_brier_total / total
    global_metrics = _finalize_metric_bucket(global_bucket)
    relevant_examples = sorted(
        examples,
        key=lambda item: (item["exact_score_hit"], item["brier_score"]),
        reverse=True,
    )[:12]

    return {
        "model_version": model_version,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "split_date": test[0]["fecha_orden"],
        "training_matches": split_index,
        "test_matches": total,
        "outcome_accuracy": global_metrics["outcome_accuracy"],
        "exact_score_accuracy": global_metrics["exact_score_accuracy"],
        "home_goals_mae": global_metrics["home_goals_mae"],
        "away_goals_mae": global_metrics["away_goals_mae"],
        "brier_score": global_metrics["brier_score"],
        "log_loss": global_metrics["log_loss"],
        "baseline_outcome_accuracy": round(baseline_hits / total, 6),
        "baseline_brier_score": round(baseline_brier_score, 6),
        "metadata": {
            "method": "temporal_rolling_origin",
            "test_ratio": test_ratio,
            "baseline_probabilities": {
                key: round(value, 6) for key, value in baseline_reference.items()
            },
            "beats_baseline_accuracy": global_metrics["outcome_accuracy"] > (baseline_hits / total),
            "beats_baseline_brier": global_metrics["brier_score"] < baseline_brier_score,
            "tournaments": {
                tournament: _finalize_metric_bucket(values)
                for tournament, values in sorted(tournament_buckets.items())
                if values["matches"] >= min_group_matches
            },
            "seasons": {
                season: _finalize_metric_bucket(values)
                for season, values in sorted(season_buckets.items())
                if values["matches"] >= min_group_matches
            },
            "examples": relevant_examples,
        },
    }

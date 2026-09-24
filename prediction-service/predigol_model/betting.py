from __future__ import annotations

import math
from typing import Any

OUTCOME_ODDS_KEYS = {
    "home": ("odds_home", "home_odds", "cuota_local", "local_odds"),
    "draw": ("odds_draw", "draw_odds", "cuota_empate", "empate_odds"),
    "away": ("odds_away", "away_odds", "cuota_visitante", "visitante_odds"),
}


def parse_decimal_odds(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        odds = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(odds) or odds <= 1.0:
        return None
    return odds


def odds_from_match(match: dict[str, Any]) -> dict[str, float]:
    nested = match.get("odds") if isinstance(match.get("odds"), dict) else {}
    result: dict[str, float] = {}
    for outcome, keys in OUTCOME_ODDS_KEYS.items():
        for key in keys:
            odds = parse_decimal_odds(match.get(key, nested.get(key)))
            if odds is not None:
                result[outcome] = odds
                break
    return result


def implied_probability(decimal_odds: float) -> float:
    if decimal_odds <= 1.0:
        raise ValueError("La cuota decimal debe ser mayor que 1.")
    return 1 / decimal_odds


def expected_value(probability: float, decimal_odds: float) -> float:
    return (probability * decimal_odds) - 1


def kelly_fraction(probability: float, decimal_odds: float, max_fraction: float = 0.05) -> float:
    if not 0 <= probability <= 1:
        raise ValueError("La probabilidad debe estar entre 0 y 1.")
    if decimal_odds <= 1.0:
        raise ValueError("La cuota decimal debe ser mayor que 1.")
    if max_fraction < 0:
        raise ValueError("max_fraction no puede ser negativo.")

    raw_fraction = expected_value(probability, decimal_odds) / (decimal_odds - 1)
    return round(min(max(raw_fraction, 0.0), max_fraction), 6)


def build_value_analysis(
    probabilities: dict[str, float],
    odds: dict[str, float],
    actual_outcome: str | None = None,
    min_edge: float = 0.03,
    max_kelly_fraction: float = 0.05,
) -> dict[str, Any]:
    outcomes = []
    for outcome, probability in probabilities.items():
        decimal_odds = odds.get(outcome)
        if decimal_odds is None:
            continue
        implied = implied_probability(decimal_odds)
        edge = probability - implied
        ev = expected_value(probability, decimal_odds)
        qualifies = edge >= min_edge and ev > 0
        unit_profit = None
        if actual_outcome is not None:
            unit_profit = (decimal_odds - 1) if actual_outcome == outcome else -1.0
        outcomes.append(
            {
                "outcome": outcome,
                "probability": round(probability, 6),
                "decimal_odds": round(decimal_odds, 6),
                "implied_probability": round(implied, 6),
                "edge": round(edge, 6),
                "expected_value": round(ev, 6),
                "qualifies": qualifies,
                "kelly_fraction_capped": kelly_fraction(probability, decimal_odds, max_kelly_fraction),
                "unit_profit_if_selected": round(unit_profit, 6) if unit_profit is not None else None,
            }
        )

    value_candidates = sorted(
        [item for item in outcomes if item["qualifies"]],
        key=lambda item: (item["expected_value"], item["edge"]),
        reverse=True,
    )
    selected = value_candidates[0] if value_candidates else None
    return {
        "odds_available": bool(outcomes),
        "min_edge": min_edge,
        "max_kelly_fraction": max_kelly_fraction,
        "selected": selected,
        "outcomes": sorted(outcomes, key=lambda item: item["expected_value"], reverse=True),
        "note": "Analisis matematico de valor esperado; no ejecuta apuestas ni garantiza ganancias.",
    }


def aggregate_value_analysis(rows: list[dict[str, Any]]) -> dict[str, Any]:
    rows_with_odds = [row for row in rows if row.get("betting_analysis", {}).get("odds_available")]
    selected = [
        row
        for row in rows_with_odds
        if row.get("betting_analysis", {}).get("selected") is not None
    ]
    settled = [
        row
        for row in selected
        if row["betting_analysis"]["selected"].get("unit_profit_if_selected") is not None
    ]
    profit = sum(row["betting_analysis"]["selected"]["unit_profit_if_selected"] for row in settled)
    staked = len(settled)
    wins = sum(1 for row in settled if row["betting_analysis"]["selected"]["unit_profit_if_selected"] > 0)

    return {
        "matches_with_odds": len(rows_with_odds),
        "value_signals": len(selected),
        "settled_signals": staked,
        "wins": wins,
        "losses": staked - wins,
        "flat_stake_profit": round(profit, 6),
        "flat_stake_roi": round(profit / staked, 6) if staked else None,
        "note": "Simulacion con una unidad por senal de valor; requiere cuotas historicas confiables.",
    }

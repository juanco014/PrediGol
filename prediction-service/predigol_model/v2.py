from __future__ import annotations

import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .poisson_elo import (
    DEFAULT_AWAY_GOALS,
    DEFAULT_HOME_GOALS,
    HOME_ELO_ADVANTAGE,
    Prediction,
    clamp,
    parse_date,
    poisson_pmf,
    team_key,
)

MODEL_VERSION_V2 = "poisson-elo-form-v2"


@dataclass(frozen=True)
class V2Config:
    half_life_matches: float = 18.0
    min_old_match_weight: float = 0.18
    max_history_matches: int = 500
    recent_form_window: int = 8
    league_min_matches: int = 20
    calibration_min_matches: int = 80
    dixon_coles_enabled: bool = True
    dixon_coles_rho: float = -0.2
    calibration_shrink: float = 0.08
    expected_goals_shrink: float = 1.0
    enable_draw_decision_adjustment: bool = True
    draw_decision_margin: float = 0.03
    enable_home_bias_adjustment: bool = False
    home_bias_multiplier: float = 1.0
    home_xg_multiplier: float = 1.0
    away_xg_multiplier: float = 1.0

    def __post_init__(self) -> None:
        if self.half_life_matches <= 0:
            raise ValueError("half_life_matches debe ser mayor que cero.")
        if not 0 <= self.min_old_match_weight <= 1:
            raise ValueError("min_old_match_weight debe estar entre 0 y 1.")
        if self.max_history_matches <= 0:
            raise ValueError("max_history_matches debe ser mayor que cero.")
        if self.recent_form_window <= 0:
            raise ValueError("recent_form_window debe ser mayor que cero.")
        if not -0.5 <= self.dixon_coles_rho <= 0.5:
            raise ValueError("dixon_coles_rho debe estar entre -0.5 y 0.5.")
        if not 0 < self.expected_goals_shrink <= 1:
            raise ValueError("expected_goals_shrink debe ser mayor que 0 y menor o igual que 1.")
        if not 0 <= self.draw_decision_margin <= 0.25:
            raise ValueError("draw_decision_margin debe estar entre 0 y 0.25.")
        if not 0.70 <= self.home_bias_multiplier <= 1.30:
            raise ValueError("home_bias_multiplier debe estar entre 0.70 y 1.30.")
        if not 0.70 <= self.home_xg_multiplier <= 1.30:
            raise ValueError("home_xg_multiplier debe estar entre 0.70 y 1.30.")
        if not 0.70 <= self.away_xg_multiplier <= 1.30:
            raise ValueError("away_xg_multiplier debe estar entre 0.70 y 1.30.")


@dataclass
class WeightedTeamStats:
    home_matches: float = 0.0
    away_matches: float = 0.0
    home_for: float = 0.0
    home_against: float = 0.0
    away_for: float = 0.0
    away_against: float = 0.0


@dataclass
class WeightedLeagueStats:
    matches: float = 0.0
    raw_matches: int = 0
    home_goals: float = 0.0
    away_goals: float = 0.0
    draws: float = 0.0
    teams: dict[str, WeightedTeamStats] = field(default_factory=lambda: defaultdict(WeightedTeamStats))

    @property
    def avg_home_goals(self) -> float:
        return self.home_goals / self.matches if self.matches else DEFAULT_HOME_GOALS

    @property
    def avg_away_goals(self) -> float:
        return self.away_goals / self.matches if self.matches else DEFAULT_AWAY_GOALS

    @property
    def draw_frequency(self) -> float:
        return self.draws / self.matches if self.matches else 0.27


class V2Prediction(Prediction):
    def to_payload(self) -> dict[str, Any]:
        payload = super().to_payload()
        payload["model_version"] = MODEL_VERSION_V2
        payload["quality_warnings"] = self.metadata.get("warnings", [])
        payload["data_quality"] = {
            "history_matches": self.metadata.get("history_matches"),
            "league_matches": self.metadata.get("league_matches"),
            "home_samples": self.metadata.get("home_samples"),
            "away_samples": self.metadata.get("away_samples"),
            "calibration_active": self.metadata.get("calibration_active"),
        }
        payload["probabilities_uncalibrated"] = self.metadata.get("raw_probabilities")
        payload["probabilities_calibrated"] = {
            "home": payload["home_win_probability"],
            "draw": payload["draw_probability"],
            "away": payload["away_win_probability"],
        }
        payload["history_matches_used"] = self.metadata.get("history_matches")
        payload["model_parameters"] = {
            "time_decay": self.metadata.get("time_decay"),
            "dixon_coles_enabled": self.metadata.get("dixon_coles_enabled"),
            "dixon_coles_rho": self.metadata.get("dixon_coles_rho"),
            "expected_goals_shrink": self.metadata.get("expected_goals_shrink"),
            "enable_draw_decision_adjustment": self.metadata.get("enable_draw_decision_adjustment"),
            "draw_decision_margin": self.metadata.get("draw_decision_margin"),
            "enable_home_bias_adjustment": self.metadata.get("enable_home_bias_adjustment"),
            "home_bias_multiplier": self.metadata.get("home_bias_multiplier"),
            "home_xg_multiplier": self.metadata.get("home_xg_multiplier"),
            "away_xg_multiplier": self.metadata.get("away_xg_multiplier"),
        }
        return payload


class PoissonEloFormModel:
    def __init__(self, history: list[dict[str, Any]], config: V2Config | None = None) -> None:
        self.config = config or V2Config()
        self.history = sorted(history, key=lambda match: parse_date(match.get("fecha_orden")))[
            -self.config.max_history_matches :
        ]
        self.global_stats = WeightedLeagueStats()
        self.league_stats: dict[str, WeightedLeagueStats] = defaultdict(WeightedLeagueStats)
        self.elo: dict[str, float] = defaultdict(lambda: 1500.0)
        self.recent_matches: dict[str, deque[dict[str, Any]]] = defaultdict(
            lambda: deque(maxlen=self.config.recent_form_window)
        )
        self.calibration_active = len(self.history) >= self.config.calibration_min_matches
        self._fit()

    def _match_weight(self, index: int) -> float:
        age = max(len(self.history) - 1 - index, 0)
        decayed = 0.5 ** (age / max(self.config.half_life_matches, 1.0))
        return clamp(decayed, self.config.min_old_match_weight, 1.0)

    def _fit(self) -> None:
        for index, match in enumerate(self.history):
            home_goals = int(match["goles_local_final"])
            away_goals = int(match["goles_visitante_final"])
            home = team_key(match.get("local_nombre"))
            away = team_key(match.get("visitante_nombre"))
            league = match.get("torneo") or "global"
            weight = self._match_weight(index)

            self._add_stats(self.global_stats, home, away, home_goals, away_goals, weight)
            self._add_stats(self.league_stats[league], home, away, home_goals, away_goals, weight)
            self._update_elo(home, away, home_goals, away_goals, weight)
            self._add_recent(home, away, home_goals, away_goals, match)

    def _add_stats(
        self,
        stats: WeightedLeagueStats,
        home: str,
        away: str,
        home_goals: int,
        away_goals: int,
        weight: float,
    ) -> None:
        stats.matches += weight
        stats.raw_matches += 1
        stats.home_goals += home_goals * weight
        stats.away_goals += away_goals * weight
        stats.draws += weight if home_goals == away_goals else 0.0

        home_stats = stats.teams[home]
        home_stats.home_matches += weight
        home_stats.home_for += home_goals * weight
        home_stats.home_against += away_goals * weight

        away_stats = stats.teams[away]
        away_stats.away_matches += weight
        away_stats.away_for += away_goals * weight
        away_stats.away_against += home_goals * weight

    def _update_elo(self, home: str, away: str, home_goals: int, away_goals: int, weight: float) -> None:
        home_rating = self.elo[home]
        away_rating = self.elo[away]
        expected_home = 1 / (1 + 10 ** (((away_rating - HOME_ELO_ADVANTAGE) - home_rating) / 400))
        actual_home = 1.0 if home_goals > away_goals else 0.5 if home_goals == away_goals else 0.0
        goal_margin = max(1, abs(home_goals - away_goals))
        change = 20 * (1 + math.log(goal_margin)) * weight * (actual_home - expected_home)
        self.elo[home] = home_rating + change
        self.elo[away] = away_rating - change

    def _add_recent(self, home: str, away: str, home_goals: int, away_goals: int, match: dict[str, Any]) -> None:
        self.recent_matches[home].append(
            {"is_home": True, "gf": home_goals, "ga": away_goals, "torneo": match.get("torneo")}
        )
        self.recent_matches[away].append(
            {"is_home": False, "gf": away_goals, "ga": home_goals, "torneo": match.get("torneo")}
        )

    def _team_rates(self, stats: WeightedLeagueStats, team: str, is_home: bool) -> tuple[float, float, float]:
        team_stats = stats.teams.get(team)
        if not team_stats:
            return 1.0, 1.0, 0.0

        if is_home:
            samples = team_stats.home_matches
            attack_raw = team_stats.home_for / samples if samples else 1.0
            defense_raw = team_stats.home_against / samples if samples else 1.0
            attack = attack_raw / stats.avg_home_goals
            defense = defense_raw / stats.avg_away_goals
        else:
            samples = team_stats.away_matches
            attack_raw = team_stats.away_for / samples if samples else 1.0
            defense_raw = team_stats.away_against / samples if samples else 1.0
            attack = attack_raw / stats.avg_away_goals
            defense = defense_raw / stats.avg_home_goals

        prior_weight = 8.0
        return (
            ((attack * samples) + prior_weight) / (samples + prior_weight) if samples else 1.0,
            ((defense * samples) + prior_weight) / (samples + prior_weight) if samples else 1.0,
            samples,
        )

    def _recent_form(self, team: str) -> dict[str, Any]:
        matches = list(self.recent_matches.get(team, []))[-self.config.recent_form_window :]
        if not matches:
            return {
                "matches": 0,
                "points_per_match": 0.0,
                "goals_for": 0.0,
                "goals_against": 0.0,
                "goal_difference": 0.0,
                "home_performance": 0.0,
                "away_performance": 0.0,
                "streak": "",
            }

        points = 0
        home_points = []
        away_points = []
        streak = []
        goals_for = 0
        goals_against = 0
        for item in matches:
            gf = int(item["gf"])
            ga = int(item["ga"])
            goals_for += gf
            goals_against += ga
            result_points = 3 if gf > ga else 1 if gf == ga else 0
            points += result_points
            streak.append("G" if gf > ga else "E" if gf == ga else "P")
            if item["is_home"]:
                home_points.append(result_points)
            else:
                away_points.append(result_points)

        count = len(matches)
        return {
            "matches": count,
            "points_per_match": round(points / count, 3),
            "goals_for": round(goals_for / count, 3),
            "goals_against": round(goals_against / count, 3),
            "goal_difference": round((goals_for - goals_against) / count, 3),
            "home_performance": round(sum(home_points) / (3 * len(home_points)), 3) if home_points else 0.0,
            "away_performance": round(sum(away_points) / (3 * len(away_points)), 3) if away_points else 0.0,
            "streak": "".join(streak[-5:]),
        }

    def _apply_dixon_coles(self, home_goals: int, away_goals: int, probability: float) -> float:
        if not self.config.dixon_coles_enabled:
            return probability
        rho = self.config.dixon_coles_rho
        if home_goals == 0 and away_goals == 0:
            return probability * (1 - rho)
        if home_goals == 1 and away_goals == 0:
            return probability * (1 + rho)
        if home_goals == 0 and away_goals == 1:
            return probability * (1 + rho)
        if home_goals == 1 and away_goals == 1:
            return probability * (1 - rho)
        return probability

    def _calibrate(self, home_win: float, draw: float, away_win: float) -> tuple[float, float, float]:
        if not self.calibration_active:
            return home_win, draw, away_win
        shrink = clamp(self.config.calibration_shrink, 0.0, 0.25)
        calibrated = [
            (home_win * (1 - shrink)) + (1 / 3 * shrink),
            (draw * (1 - shrink)) + (1 / 3 * shrink),
            (away_win * (1 - shrink)) + (1 / 3 * shrink),
        ]
        total = sum(calibrated) or 1.0
        return calibrated[0] / total, calibrated[1] / total, calibrated[2] / total

    def _select_predicted_outcome(self, home_win: float, draw: float, away_win: float) -> tuple[str, str, bool]:
        probabilities = {"home": home_win, "draw": draw, "away": away_win}
        base_outcome = max(("home", "draw", "away"), key=probabilities.get)
        if not self.config.enable_draw_decision_adjustment:
            return base_outcome, base_outcome, False

        max_probability = probabilities[base_outcome]
        if draw >= max_probability - self.config.draw_decision_margin:
            return "draw", base_outcome, base_outcome != "draw"
        return base_outcome, base_outcome, False

    def predict(self, match: dict[str, Any]) -> V2Prediction:
        home = team_key(match.get("local_nombre"))
        away = team_key(match.get("visitante_nombre"))
        league_name = match.get("torneo") or "global"
        league = self.league_stats.get(league_name)
        league_used = league_name
        warnings: list[str] = []

        if not league or league.raw_matches < self.config.league_min_matches:
            league = self.global_stats
            league_used = "global"
            warnings.append("Torneo con pocos historicos; se usan parametros globales.")

        home_attack, _home_defense, home_samples = self._team_rates(league, home, True)
        away_attack, away_defense, away_samples = self._team_rates(league, away, False)
        home_form = self._recent_form(home)
        away_form = self._recent_form(away)

        home_rating = self.elo[home]
        away_rating = self.elo[away]
        elo_delta = (home_rating + HOME_ELO_ADVANTAGE) - away_rating
        form_delta = home_form["points_per_match"] - away_form["points_per_match"]
        home_elo_factor = clamp(1 + (elo_delta / 1900) + (form_delta * 0.035), 0.72, 1.28)
        away_elo_factor = clamp(1 - (elo_delta / 1900) - (form_delta * 0.035), 0.72, 1.28)
        if self.config.enable_home_bias_adjustment:
            home_elo_factor = clamp(home_elo_factor * self.config.home_bias_multiplier, 0.72, 1.28)
        volatility = clamp((league.avg_home_goals + league.avg_away_goals) / 2.45, 0.85, 1.18)

        expected_home_before_adjustment = clamp(
            league.avg_home_goals * home_attack * away_defense * home_elo_factor * volatility,
            0.15,
            4.8,
        )
        expected_away_before_adjustment = clamp(
            league.avg_away_goals * away_attack * away_elo_factor * volatility,
            0.15,
            4.8,
        )
        expected_home = expected_home_before_adjustment
        expected_away = expected_away_before_adjustment
        if self.config.enable_home_bias_adjustment:
            expected_home = max(0.15, expected_home * self.config.home_xg_multiplier)
            expected_away = max(0.15, expected_away * self.config.away_xg_multiplier)
        expected_home = max(0.15, expected_home * self.config.expected_goals_shrink)
        expected_away = max(0.15, expected_away * self.config.expected_goals_shrink)

        matrix = []
        for home_goals in range(9):
            for away_goals in range(9):
                probability = poisson_pmf(expected_home, home_goals) * poisson_pmf(expected_away, away_goals)
                matrix.append((home_goals, away_goals, self._apply_dixon_coles(home_goals, away_goals, probability)))

        total_probability = sum(item[2] for item in matrix) or 1.0
        normalized = [(hg, ag, probability / total_probability) for hg, ag, probability in matrix]
        raw_home_win = sum(probability for hg, ag, probability in normalized if hg > ag)
        raw_draw = sum(probability for hg, ag, probability in normalized if hg == ag)
        raw_away_win = sum(probability for hg, ag, probability in normalized if hg < ag)
        home_win, draw, away_win = self._calibrate(raw_home_win, raw_draw, raw_away_win)
        predicted_home, predicted_away, score_probability = max(normalized, key=lambda item: item[2])
        predicted_outcome, base_predicted_outcome, draw_decision_adjusted = self._select_predicted_outcome(
            home_win,
            draw,
            away_win,
        )
        confidence = max(home_win, draw, away_win)

        if home_form["matches"] < 3 or away_form["matches"] < 3:
            warnings.append("Uno o ambos equipos tienen poca forma reciente cargada.")
        if len(self.history) < self.config.calibration_min_matches:
            warnings.append("Calibracion desactivada por historicos insuficientes.")

        return V2Prediction(
            match=match,
            home_win_probability=home_win,
            draw_probability=draw,
            away_win_probability=away_win,
            expected_home_goals=expected_home,
            expected_away_goals=expected_away,
            predicted_home_goals=predicted_home,
            predicted_away_goals=predicted_away,
            confidence=confidence,
            metadata={
                "league_used": league_used,
                "history_matches": len(self.history),
                "league_matches": league.raw_matches,
                "home_rating": round(home_rating, 2),
                "away_rating": round(away_rating, 2),
                "home_samples": round(home_samples, 2),
                "away_samples": round(away_samples, 2),
                "score_probability": round(score_probability, 6),
                "raw_probabilities": {
                    "home": round(raw_home_win, 6),
                    "draw": round(raw_draw, 6),
                    "away": round(raw_away_win, 6),
                },
                "calibration_active": self.calibration_active,
                "dixon_coles_enabled": self.config.dixon_coles_enabled,
                "dixon_coles_rho": self.config.dixon_coles_rho,
                "expected_goals_shrink": self.config.expected_goals_shrink,
                "enable_draw_decision_adjustment": self.config.enable_draw_decision_adjustment,
                "draw_decision_margin": self.config.draw_decision_margin,
                "enable_home_bias_adjustment": self.config.enable_home_bias_adjustment,
                "home_bias_multiplier": self.config.home_bias_multiplier,
                "home_xg_multiplier": self.config.home_xg_multiplier,
                "away_xg_multiplier": self.config.away_xg_multiplier,
                "expected_home_goals_before_home_bias_adjustment": round(expected_home_before_adjustment, 6),
                "expected_away_goals_before_home_bias_adjustment": round(expected_away_before_adjustment, 6),
                "predicted_outcome": predicted_outcome,
                "predicted_outcome_base": base_predicted_outcome,
                "draw_decision_adjusted": draw_decision_adjusted,
                "time_decay": {
                    "half_life_matches": self.config.half_life_matches,
                    "min_old_match_weight": self.config.min_old_match_weight,
                    "max_history_matches": self.config.max_history_matches,
                },
                "tournament_parameters": {
                    "avg_home_goals": round(league.avg_home_goals, 3),
                    "avg_away_goals": round(league.avg_away_goals, 3),
                    "draw_frequency": round(league.draw_frequency, 3),
                    "volatility": round(volatility, 3),
                },
                "recent_form": {
                    "home": home_form,
                    "away": away_form,
                },
                "warnings": warnings,
            },
        )

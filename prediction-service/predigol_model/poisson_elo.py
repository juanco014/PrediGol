from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

MODEL_VERSION = "poisson-elo-v1"
HOME_ELO_ADVANTAGE = 60
DEFAULT_HOME_GOALS = 1.35
DEFAULT_AWAY_GOALS = 1.10


def team_key(name: str | None) -> str:
    return (name or "").strip().casefold()


def parse_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def clamp(value: float, lower: float, upper: float) -> float:
    return min(max(value, lower), upper)


def blend(value: float, samples: int, prior: float = 1.0, prior_weight: int = 8) -> float:
    if samples <= 0 or not math.isfinite(value):
        return prior

    return ((value * samples) + (prior * prior_weight)) / (samples + prior_weight)


def poisson_pmf(expected_goals: float, goals: int) -> float:
    return math.exp(-expected_goals) * (expected_goals**goals) / math.factorial(goals)


@dataclass
class TeamStats:
    home_matches: int = 0
    away_matches: int = 0
    home_for: int = 0
    home_against: int = 0
    away_for: int = 0
    away_against: int = 0


@dataclass
class LeagueStats:
    matches: int = 0
    home_goals: int = 0
    away_goals: int = 0
    teams: dict[str, TeamStats] = field(default_factory=lambda: defaultdict(TeamStats))

    @property
    def avg_home_goals(self) -> float:
        return self.home_goals / self.matches if self.matches else DEFAULT_HOME_GOALS

    @property
    def avg_away_goals(self) -> float:
        return self.away_goals / self.matches if self.matches else DEFAULT_AWAY_GOALS


@dataclass
class Prediction:
    match: dict[str, Any]
    home_win_probability: float
    draw_probability: float
    away_win_probability: float
    expected_home_goals: float
    expected_away_goals: float
    predicted_home_goals: int
    predicted_away_goals: int
    confidence: float
    metadata: dict[str, Any]

    def to_payload(self) -> dict[str, Any]:
        return {
            "api_football_fixture_id": self.match["api_football_fixture_id"],
            "partido_id": str(self.match["id"]),
            "home_win_probability": round(self.home_win_probability, 6),
            "draw_probability": round(self.draw_probability, 6),
            "away_win_probability": round(self.away_win_probability, 6),
            "expected_home_goals": round(self.expected_home_goals, 3),
            "expected_away_goals": round(self.expected_away_goals, 3),
            "predicted_home_goals": self.predicted_home_goals,
            "predicted_away_goals": self.predicted_away_goals,
            "confidence": round(self.confidence, 6),
            "model_version": MODEL_VERSION,
            "metadata": self.metadata,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


class PoissonEloModel:
    def __init__(self, history: list[dict[str, Any]]) -> None:
        self.history = sorted(history, key=lambda match: parse_date(match.get("fecha_orden")))
        self.global_stats = LeagueStats()
        self.league_stats: dict[str, LeagueStats] = defaultdict(LeagueStats)
        self.elo: dict[str, float] = defaultdict(lambda: 1500.0)
        self._fit()

    def _fit(self) -> None:
        for match in self.history:
            home_goals = int(match["goles_local_final"])
            away_goals = int(match["goles_visitante_final"])
            home = team_key(match.get("local_nombre"))
            away = team_key(match.get("visitante_nombre"))
            league = match.get("torneo") or "global"

            self._add_stats(self.global_stats, home, away, home_goals, away_goals)
            self._add_stats(self.league_stats[league], home, away, home_goals, away_goals)
            self._update_elo(home, away, home_goals, away_goals)

    def _add_stats(
        self,
        stats: LeagueStats,
        home: str,
        away: str,
        home_goals: int,
        away_goals: int,
    ) -> None:
        stats.matches += 1
        stats.home_goals += home_goals
        stats.away_goals += away_goals

        home_stats = stats.teams[home]
        home_stats.home_matches += 1
        home_stats.home_for += home_goals
        home_stats.home_against += away_goals

        away_stats = stats.teams[away]
        away_stats.away_matches += 1
        away_stats.away_for += away_goals
        away_stats.away_against += home_goals

    def _update_elo(self, home: str, away: str, home_goals: int, away_goals: int) -> None:
        home_rating = self.elo[home]
        away_rating = self.elo[away]
        expected_home = 1 / (1 + 10 ** (((away_rating - HOME_ELO_ADVANTAGE) - home_rating) / 400))

        if home_goals > away_goals:
            actual_home = 1.0
        elif home_goals == away_goals:
            actual_home = 0.5
        else:
            actual_home = 0.0

        goal_margin = max(1, abs(home_goals - away_goals))
        k_factor = 20 * (1 + math.log(goal_margin))
        change = k_factor * (actual_home - expected_home)

        self.elo[home] = home_rating + change
        self.elo[away] = away_rating - change

    def _team_rates(self, stats: LeagueStats, team: str, is_home: bool) -> tuple[float, float, int]:
        team_stats = stats.teams.get(team)

        if not team_stats:
            return 1.0, 1.0, 0

        if is_home:
            attack_raw = team_stats.home_for / team_stats.home_matches if team_stats.home_matches else 1.0
            defense_raw = team_stats.home_against / team_stats.home_matches if team_stats.home_matches else 1.0
            attack = attack_raw / stats.avg_home_goals
            defense = defense_raw / stats.avg_away_goals
            samples = team_stats.home_matches
        else:
            attack_raw = team_stats.away_for / team_stats.away_matches if team_stats.away_matches else 1.0
            defense_raw = team_stats.away_against / team_stats.away_matches if team_stats.away_matches else 1.0
            attack = attack_raw / stats.avg_away_goals
            defense = defense_raw / stats.avg_home_goals
            samples = team_stats.away_matches

        return blend(attack, samples), blend(defense, samples), samples

    def predict(self, match: dict[str, Any]) -> Prediction:
        home = team_key(match.get("local_nombre"))
        away = team_key(match.get("visitante_nombre"))
        league_name = match.get("torneo") or "global"
        league = self.league_stats.get(league_name)
        league_used = league_name

        if not league or league.matches < 20:
            league = self.global_stats
            league_used = "global"

        home_attack, _home_defense, home_samples = self._team_rates(league, home, True)
        away_attack, away_defense, away_samples = self._team_rates(league, away, False)

        home_rating = self.elo[home]
        away_rating = self.elo[away]
        elo_delta = (home_rating + HOME_ELO_ADVANTAGE) - away_rating
        home_elo_factor = clamp(1 + (elo_delta / 1800), 0.75, 1.25)
        away_elo_factor = clamp(1 - (elo_delta / 1800), 0.75, 1.25)

        expected_home = clamp(
            league.avg_home_goals * home_attack * away_defense * home_elo_factor,
            0.2,
            4.5,
        )
        expected_away = clamp(
            league.avg_away_goals * away_attack * away_elo_factor,
            0.2,
            4.5,
        )

        matrix = []
        for home_goals in range(9):
            for away_goals in range(9):
                probability = poisson_pmf(expected_home, home_goals) * poisson_pmf(
                    expected_away,
                    away_goals,
                )
                matrix.append((home_goals, away_goals, probability))

        total_probability = sum(item[2] for item in matrix) or 1.0
        normalized = [
            (home_goals, away_goals, probability / total_probability)
            for home_goals, away_goals, probability in matrix
        ]

        home_win = sum(probability for home_goals, away_goals, probability in normalized if home_goals > away_goals)
        draw = sum(probability for home_goals, away_goals, probability in normalized if home_goals == away_goals)
        away_win = sum(probability for home_goals, away_goals, probability in normalized if home_goals < away_goals)
        predicted_home, predicted_away, score_probability = max(normalized, key=lambda item: item[2])

        confidence = max(home_win, draw, away_win)

        return Prediction(
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
                "league_matches": league.matches,
                "home_rating": round(home_rating, 2),
                "away_rating": round(away_rating, 2),
                "home_samples": home_samples,
                "away_samples": away_samples,
                "score_probability": round(score_probability, 6),
            },
        )

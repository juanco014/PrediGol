from __future__ import annotations

import unittest

from predigol_model.betting import (
    aggregate_value_analysis,
    build_value_analysis,
    expected_value,
    implied_probability,
    kelly_fraction,
    odds_from_match,
    parse_decimal_odds,
)


class BettingAnalysisTests(unittest.TestCase):
    def test_decimal_odds_are_validated(self) -> None:
        self.assertEqual(parse_decimal_odds("2.10"), 2.10)
        self.assertIsNone(parse_decimal_odds("1.0"))
        self.assertIsNone(parse_decimal_odds("abc"))
        self.assertIsNone(parse_decimal_odds(None))

    def test_odds_are_extracted_from_common_match_fields(self) -> None:
        odds = odds_from_match(
            {
                "cuota_local": "2.30",
                "odds_draw": 3.1,
                "odds": {"away_odds": "2.80"},
            }
        )

        self.assertEqual(odds, {"home": 2.3, "draw": 3.1, "away": 2.8})

    def test_expected_value_and_kelly_fraction(self) -> None:
        self.assertAlmostEqual(implied_probability(2.5), 0.4)
        self.assertAlmostEqual(expected_value(0.48, 2.5), 0.2)
        self.assertAlmostEqual(kelly_fraction(0.48, 2.5, max_fraction=0.20), 0.133333)
        self.assertEqual(kelly_fraction(0.35, 2.5), 0.0)

    def test_value_analysis_selects_only_positive_edge(self) -> None:
        analysis = build_value_analysis(
            {"home": 0.50, "draw": 0.25, "away": 0.25},
            {"home": 2.2, "draw": 3.0, "away": 3.5},
            actual_outcome="home",
            min_edge=0.03,
        )

        self.assertTrue(analysis["odds_available"])
        self.assertEqual(analysis["selected"]["outcome"], "home")
        self.assertGreater(analysis["selected"]["expected_value"], 0)
        self.assertGreater(analysis["selected"]["unit_profit_if_selected"], 0)

    def test_aggregate_value_analysis_reports_flat_stake_roi(self) -> None:
        rows = [
            {
                "betting_analysis": build_value_analysis(
                    {"home": 0.50, "draw": 0.25, "away": 0.25},
                    {"home": 2.2, "draw": 3.0, "away": 3.5},
                    actual_outcome="home",
                )
            },
            {
                "betting_analysis": build_value_analysis(
                    {"home": 0.52, "draw": 0.23, "away": 0.25},
                    {"home": 2.1, "draw": 3.0, "away": 3.4},
                    actual_outcome="draw",
                )
            },
        ]

        summary = aggregate_value_analysis(rows)

        self.assertEqual(summary["matches_with_odds"], 2)
        self.assertEqual(summary["value_signals"], 2)
        self.assertEqual(summary["settled_signals"], 2)
        self.assertEqual(summary["wins"], 1)
        self.assertAlmostEqual(summary["flat_stake_profit"], 0.2)
        self.assertAlmostEqual(summary["flat_stake_roi"], 0.1)


if __name__ == "__main__":
    unittest.main()

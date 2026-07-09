from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from predigol_model.comparative_backtest import compare_v1_v2


def build_history(matches: int = 60) -> list[dict[str, object]]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return [
        {
            "id": index + 1,
            "api_football_fixture_id": index + 1,
            "torneo": "Liga de prueba",
            "fecha_orden": (start + timedelta(days=index)).isoformat(),
            "local_nombre": f"Equipo {index % 6}",
            "visitante_nombre": f"Equipo {(index + 1) % 6}",
            "goles_local_final": (index * 2) % 4,
            "goles_visitante_final": (index + 1) % 3,
        }
        for index in range(matches)
    ]


class ComparativeBacktestTests(unittest.TestCase):
    def test_compares_same_matches_temporally(self) -> None:
        result = compare_v1_v2(build_history(50), min_training_matches=30)
        self.assertEqual(result["evaluated_matches"], 20)
        versions = result["models"]
        self.assertEqual(len(versions), 2)
        self.assertEqual(result["summaries"][versions[0]]["matches"], result["summaries"][versions[1]]["matches"])
        self.assertIn("goals_mae", result["summaries"][versions[0]])
        self.assertIn("evaluation_date_from", result["summaries"][versions[0]])
        self.assertEqual(len(result["summaries"][versions[0]]["calibration"]), 5)
        for row in result["rows"]:
            self.assertGreaterEqual(row["data_quality"]["training_matches_before_match"], 30)
            self.assertGreaterEqual(row["brier_score"], 0)
            self.assertGreaterEqual(row["log_loss"], 0)

    def test_small_backtest_is_marked_preliminary(self) -> None:
        result = compare_v1_v2(build_history(35), min_training_matches=30)

        self.assertTrue(result["data_quality"]["preliminary"])
        self.assertIn("No existe evidencia suficiente", result["interpretation"])

    def test_v2_diagnostics_are_reported_without_changing_base_rows(self) -> None:
        result = compare_v1_v2(build_history(55), min_training_matches=30)
        versions = result["models"]
        v2_version = versions[1]
        v2_rows = [row for row in result["rows"] if row["model_version"] == v2_version]
        diagnostics = result["diagnostics"]["v2"]

        self.assertEqual(diagnostics["matches"], len(v2_rows))
        self.assertNotIn("v1", result["diagnostics"])
        self.assertEqual(sum(diagnostics["predicted_outcome_distribution"].values()), len(v2_rows))
        self.assertEqual(sum(diagnostics["actual_outcome_distribution"].values()), len(v2_rows))
        self.assertEqual(sum(diagnostics["argmax_distribution"].values()), len(v2_rows))
        self.assertEqual(len(diagnostics["draw_decision_margin_sweep"]), 7)
        self.assertEqual(len(diagnostics["experiment_5"]), 8)
        self.assertEqual(len(diagnostics["experiment_6"]), 6)
        self.assertIn("0.03", diagnostics["draw_within_max_margin_counts"])
        self.assertIn("0.10", diagnostics["draw_within_max_margin_counts"])
        self.assertIn("home_bias", diagnostics)
        self.assertIn("xg", diagnostics)

        baseline_accuracy = result["summaries"][v2_version]["outcome_accuracy"]
        zero_margin = diagnostics["draw_decision_margin_sweep"][0]
        self.assertEqual(zero_margin["margin"], 0.0)
        self.assertAlmostEqual(zero_margin["accuracy"], baseline_accuracy, places=6)
        self.assertEqual(zero_margin["accuracy_delta_vs_baseline"], 0.0)

        neutral_home_xg = diagnostics["experiment_5"][0]
        self.assertEqual(neutral_home_xg["label"], "home_xg_multiplier=1.00")
        self.assertAlmostEqual(neutral_home_xg["accuracy"], baseline_accuracy, places=6)
        self.assertIn("brier_score", neutral_home_xg)
        self.assertIn("log_loss", neutral_home_xg)
        self.assertIn("predicted_outcome_distribution", neutral_home_xg)
        self.assertIn("expected_home_goals_mean", neutral_home_xg)
        self.assertEqual(sum(neutral_home_xg["predicted_outcome_distribution"].values()), len(v2_rows))

        neutral_draw = diagnostics["experiment_6"][0]
        self.assertEqual(neutral_draw["label"], "home_xg=0.90_draw_multiplier=1.00")
        self.assertIn("predicted_draws", neutral_draw)
        self.assertIn("draw_hits", neutral_draw)
        self.assertIn("false_draws", neutral_draw)
        self.assertIn("precision_when_predicting_draw", neutral_draw)
        self.assertEqual(sum(neutral_draw["predicted_outcome_distribution"].values()), len(v2_rows))

        for row in v2_rows:
            self.assertIn(row["predicted_outcome"], {"home", "draw", "away"})

    def test_experiment_7_reports_multiseason_candidate_validation(self) -> None:
        history = build_history(80)
        for index, match in enumerate(history):
            match["temporada"] = 2024 if index < 40 else 2025
        result = compare_v1_v2(history, min_training_matches=30)
        v2_version = result["models"][1]
        experiment = result["diagnostics"]["experiment_7"]

        labels = [item["label"] for item in experiment["aggregate"]]
        self.assertEqual(labels, ["V1 baseline", "V2 baseline", "V2 home_xg=0.95", "V2 home_xg=0.90", "V2 home_xg=0.85"])
        self.assertEqual(len(experiment["by_season"]), 2)
        self.assertEqual(len(experiment["by_dataset"]), 2)
        self.assertEqual(len(experiment["by_league"]), 1)

        v2_baseline = next(item for item in experiment["aggregate"] if item["label"] == "V2 baseline")
        self.assertAlmostEqual(v2_baseline["accuracy"], result["summaries"][v2_version]["outcome_accuracy"], places=6)
        self.assertEqual(v2_baseline["parameters"], {})

        candidate = next(item for item in experiment["aggregate"] if item["label"] == "V2 home_xg=0.90")
        self.assertTrue(candidate["parameters"]["enable_home_bias_adjustment"])
        self.assertEqual(candidate["parameters"]["home_xg_multiplier"], 0.90)
        self.assertEqual(candidate["matches"], len([row for row in result["rows"] if row["model_version"] == v2_version]))

        for group in experiment["by_dataset"]:
            self.assertIn("dataset", group)
            self.assertIn("date_from", group)
            self.assertEqual(len(group["candidates"]), 5)


if __name__ == "__main__":
    unittest.main()

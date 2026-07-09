from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from predigol_model.evaluation import evaluate_temporal_holdout


def build_history(matches: int = 60) -> list[dict[str, object]]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    rows = []

    for index in range(matches):
        rows.append(
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
        )

    return rows


class EvaluationTests(unittest.TestCase):
    def test_temporal_holdout_has_valid_metrics(self) -> None:
        evaluation = evaluate_temporal_holdout(build_history())

        self.assertEqual(evaluation["training_matches"], 48)
        self.assertEqual(evaluation["test_matches"], 12)
        self.assertGreaterEqual(evaluation["outcome_accuracy"], 0)
        self.assertLessEqual(evaluation["outcome_accuracy"], 1)
        self.assertGreaterEqual(evaluation["exact_score_accuracy"], 0)
        self.assertLessEqual(evaluation["exact_score_accuracy"], 1)
        self.assertGreaterEqual(evaluation["brier_score"], 0)
        self.assertGreaterEqual(evaluation["log_loss"], 0)
        self.assertEqual(evaluation["metadata"]["method"], "temporal_rolling_origin")

    def test_rejects_history_without_enough_holdout_rows(self) -> None:
        with self.assertRaises(ValueError):
            evaluate_temporal_holdout(build_history(35))


if __name__ == "__main__":
    unittest.main()

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


if __name__ == "__main__":
    unittest.main()

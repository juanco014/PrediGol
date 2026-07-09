from __future__ import annotations

import unittest

from predigol_model.data_quality import DataQualityThresholds, build_data_quality_report
from test_evaluation import build_history


class DataQualityTests(unittest.TestCase):
    def test_marks_small_samples_as_preliminary(self) -> None:
        report = build_data_quality_report(
            build_history(20),
            pending_aliases=2,
            discarded_matches=3,
            thresholds=DataQualityThresholds(min_finished_matches=50, min_temporal_days=60),
            evaluated_matches=10,
            same_evaluation_set=True,
        )

        self.assertTrue(report["preliminary"])
        self.assertEqual(report["pending_aliases"], 2)
        self.assertGreaterEqual(len(report["warnings"]), 3)

    def test_flags_invalid_model_comparison_set(self) -> None:
        report = build_data_quality_report(build_history(80), same_evaluation_set=False)
        self.assertIn("Comparacion no valida", " ".join(report["warnings"]))


if __name__ == "__main__":
    unittest.main()

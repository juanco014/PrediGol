from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from scripts import backtest_v1_v2, listar_datasets


def match(index: int, season: int, status: str = "finalizado") -> dict[str, object]:
    start = datetime(season, 8, 1, tzinfo=timezone.utc)
    return {
        "id": f"{season}-{index}",
        "api_football_fixture_id": season * 1000 + index,
        "torneo": "Premier League",
        "temporada": season,
        "fecha_orden": (start + timedelta(days=index)).isoformat(),
        "local_nombre": f"Team {index % 8}",
        "visitante_nombre": f"Team {(index + 1) % 8}",
        "estado": status,
        "goles_local_final": (index * 2) % 4 if status == "finalizado" else None,
        "goles_visitante_final": (index + 1) % 3 if status == "finalizado" else None,
    }


def write_dataset(path: Path, season: int, matches: list[dict[str, object]]) -> None:
    path.write_text(
        json.dumps(
            {
                "name": f"api_football league 39 season {season}",
                "provider": "api_football",
                "league_id": "39",
                "season": season,
                "checksum": f"checksum-{season}",
                "quality": {"status": "valid", "valid_for_training": True},
                "matches": matches,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


class DatasetScriptsTests(unittest.TestCase):
    def test_listar_datasets_summarizes_local_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            dataset = reports / "api_api_football_liga-39_temporada-2025_dataset.json"
            write_dataset(dataset, 2025, [match(1, 2025), match(2, 2025, status="proximo")])

            summaries = [listar_datasets.summarize_dataset(path) for path in listar_datasets.dataset_files(reports)]

        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0]["provider"], "api_football")
        self.assertEqual(summaries[0]["total_matches"], 2)
        self.assertEqual(summaries[0]["finished_matches"], 1)
        self.assertEqual(summaries[0]["quality_status"], "valid")

    def test_backtest_combines_datasets_and_ignores_pending_matches(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            reports = base / "reports"
            reports.mkdir()
            d2024 = base / "api_api_football_liga-39_temporada-2024_dataset.json"
            d2025 = base / "api_api_football_liga-39_temporada-2025_dataset.json"
            write_dataset(d2024, 2024, [match(index, 2024) for index in range(25)])
            write_dataset(d2025, 2025, [match(index, 2025) for index in range(10)] + [match(99, 2025, status="proximo")])

            with patch.object(backtest_v1_v2, "REPORTS", reports):
                code = backtest_v1_v2.main([
                    "--datasets",
                    str(d2024),
                    str(d2025),
                    "--season",
                    "2025",
                    "--min-training",
                    "20",
                ])

            report_files = sorted(reports.glob("backtest_v1_v2_*.json"))
            result = json.loads(report_files[-1].read_text(encoding="utf-8"))

        self.assertEqual(code, 0)
        self.assertEqual(result["source_summary"]["raw_matches"], 36)
        self.assertEqual(result["source_summary"]["finished_matches_used"], 35)
        self.assertEqual(result["source_summary"]["ignored_non_finished_matches"], 1)
        self.assertEqual(result["evaluated_matches"], 10)
        self.assertEqual(len(result["dataset_sources"]), 2)
        self.assertIn("evaluation_date_from", next(iter(result["summaries"].values())))
        self.assertEqual(len(next(iter(result["summaries"].values()))["calibration"]), 5)
        self.assertTrue(any("partidos no finalizados" in warning for warning in result["anti_leakage"]["warnings"]))


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from predigol_model.importers import validate_and_normalize_rows
from scripts import backtest_v1_v2, generar_pronosticos, importar_ligas_temporadas, listar_datasets


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


@dataclass
class FakeFetched:
    raw_count: int
    warnings: list[str] = field(default_factory=list)


class FakeBatchImporter:
    def import_season(self, league_id: str, season: int, include_upcoming: bool = False):
        if league_id == "999":
            raise RuntimeError("liga no disponible")
        rows = [
            {
                "fecha": f"{season}-08-{index + 1:02d}T20:00:00+00:00",
                "torneo": f"Liga {league_id}",
                "temporada": season,
                "local": f"Local {index}",
                "visitante": f"Visitante {index}",
                "goles_local": str(index % 3),
                "goles_visitante": str((index + 1) % 3),
                "estado": "finalizado",
                "api_football_fixture_id": str(int(league_id) * 100000 + season * 10 + index),
            }
            for index in range(2)
        ]
        return validate_and_normalize_rows(rows, f"api-{league_id}-{season}"), FakeFetched(raw_count=len(rows))


class FakeBatchApi:
    provider = "api_football"

    def __init__(self) -> None:
        self.importer = FakeBatchImporter()


class DatasetScriptsTests(unittest.TestCase):
    def test_generar_pronosticos_uses_v1_by_default(self) -> None:
        matches = [match(index, 2024) for index in range(40)]
        metadata = {"name": "test dataset", "provider": "api_football", "league_id": "39", "season": 2024, "checksum": "abc"}

        result = generar_pronosticos.generate_predictions(metadata, matches, min_training=30)

        self.assertEqual(result["model"]["key"], "v1")
        self.assertEqual(result["model"]["status"], "production")
        self.assertEqual(result["summary"]["predictions_generated"], 10)
        first = result["predictions"][0]
        self.assertEqual(first["model_version"], "poisson-elo-v1")
        self.assertIn("p_home", first)
        self.assertIn("probable_score", first)
        self.assertIn(first["access_tier"], {"free", "premium_candidate"})

    def test_generar_pronosticos_cli_does_not_overwrite_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            dataset = base / "dataset.json"
            output = base / "pronosticos.json"
            write_dataset(dataset, 2024, [match(index, 2024) for index in range(35)])
            output.write_text("existing", encoding="utf-8")

            code = generar_pronosticos.main(["--dataset", str(dataset), "--output", str(output)])
            content = output.read_text(encoding="utf-8")

        self.assertEqual(code, 0)
        self.assertEqual(content, "existing")

    def test_generar_pronosticos_cli_writes_output_with_force(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            dataset = base / "dataset.json"
            output = base / "pronosticos.json"
            write_dataset(dataset, 2024, [match(index, 2024) for index in range(35)])

            code = generar_pronosticos.main([
                "--dataset",
                str(dataset),
                "--output",
                str(output),
                "--min-training",
                "30",
                "--force",
            ])
            payload = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(code, 0)
        self.assertEqual(payload["summary"]["predictions_generated"], 5)
        self.assertIn("prediction_checksum", payload["traceability"])

    def test_multi_import_parses_arguments_and_output_path(self) -> None:
        leagues = importar_ligas_temporadas.parse_leagues(["Premier League:39,140"])
        seasons = importar_ligas_temporadas.parse_seasons("2022,2024")
        path = importar_ligas_temporadas.dataset_path(Path("reports"), "api_football", "39", 2024)

        self.assertEqual([(item.name, item.league_id) for item in leagues], [("Premier League", "39"), ("140", "140")])
        self.assertEqual(seasons, [2022, 2024])
        self.assertEqual(path, Path("reports/api_api_football_liga-39_temporada-2024_dataset.json"))

    def test_multi_import_skips_existing_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            existing = reports / "api_api_football_liga-39_temporada-2024_dataset.json"
            write_dataset(existing, 2024, [match(1, 2024)])

            with patch.object(importar_ligas_temporadas, "create_external_football_api") as api_mock:
                summaries = importar_ligas_temporadas.run_imports(
                    [importar_ligas_temporadas.LeagueTarget("Premier League", "39")],
                    [2024],
                    provider="api_football",
                    output_dir=reports,
                )

        self.assertEqual(summaries[0]["status"], "skipped_existing")
        api_mock.assert_not_called()

    def test_multi_import_writes_summary_and_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            with patch.object(importar_ligas_temporadas, "create_external_football_api", return_value=FakeBatchApi()):
                summaries = importar_ligas_temporadas.run_imports(
                    [importar_ligas_temporadas.LeagueTarget("Liga 39", "39")],
                    [2024],
                    provider="api_football",
                    output_dir=reports,
                    force=True,
                )
            dataset = reports / "api_api_football_liga-39_temporada-2024_dataset.json"
            dataset_exists = dataset.exists()

        self.assertEqual(summaries[0]["status"], "imported")
        self.assertEqual(summaries[0]["matches_found"], 2)
        self.assertEqual(summaries[0]["finished_matches"], 2)
        self.assertEqual(summaries[0]["discarded_matches"], 0)
        self.assertTrue(dataset_exists)

    def test_multi_import_continues_after_partial_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            with patch.object(importar_ligas_temporadas, "create_external_football_api", return_value=FakeBatchApi()):
                summaries = importar_ligas_temporadas.run_imports(
                    [importar_ligas_temporadas.LeagueTarget("Ok", "39"), importar_ligas_temporadas.LeagueTarget("Error", "999")],
                    [2024],
                    provider="api_football",
                    output_dir=reports,
                    force=True,
                )

        self.assertEqual([item["status"] for item in summaries], ["imported", "error"])
        self.assertIn("liga no disponible", summaries[1]["error"])

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

from __future__ import annotations

import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any
from unittest.mock import patch

import httpx

from predigol_model.api_football_importer import (
    ApiFootballAuthError,
    ApiFootballClient,
    ApiFootballError,
    ApiFootballImporter,
    ApiFootballRateLimitError,
    fixture_to_import_row,
)
from predigol_model.data_quality import validate_imported_dataset
from predigol_model.team_normalization import TeamAlias, TeamNormalizer
from predigol_model.importers import load_and_validate
from scripts.importar_temporada import confirm_import
from scripts import importar_temporada_api


class FakeSupabaseClient:
    def __init__(self) -> None:
        self.partidos: dict[int, dict[str, Any]] = {}
        self.datasets: dict[str, dict[str, Any]] = {}
        self.runs: list[dict[str, Any]] = []

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        if table != "partidos":
            return []
        if "payload_api->fallback_identity->>key" in params:
            raw_filter = params.get("payload_api->fallback_identity->>key", "in.()")
            keys = {item for item in raw_filter.removeprefix("in.(").removesuffix(")").split(",") if item}
            return [
                {"payload_api": row.get("payload_api", {})}
                for row in self.partidos.values()
                if row.get("payload_api", {}).get("fallback_identity", {}).get("key") in keys
            ]
        raw_filter = params.get("api_football_fixture_id", "in.()")
        fixture_ids = [int(item) for item in raw_filter.removeprefix("in.(").removesuffix(")").split(",") if item]
        return [{"api_football_fixture_id": fixture_id} for fixture_id in fixture_ids if fixture_id in self.partidos]

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        if table == "partidos":
            for row in rows:
                self.partidos[int(row[on_conflict])] = dict(row)
            return [dict(row) for row in rows]
        if table == "model_datasets":
            row = dict(rows[0])
            checksum = row[on_conflict]
            stored = {**self.datasets.get(checksum, {}), **row, "id": f"dataset-{len(self.datasets) + 1}"}
            self.datasets[checksum] = stored
            return [stored]
        raise AssertionError(table)

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        if table != "model_runs":
            raise AssertionError(table)
        stored = {**row, "id": f"run-{len(self.runs) + 1}"}
        self.runs.append(stored)
        return stored


def fixture(fixture_id: int = 100, home: str = "America de Cali", away: str = "Cali", date: str = "2025-01-01T20:00:00+00:00", status: str = "FT") -> dict[str, Any]:
    return {
        "fixture": {"id": fixture_id, "date": date, "status": {"short": status, "elapsed": 90}},
        "league": {"id": 239, "name": "Liga BetPlay", "season": 2025, "round": "Regular Season - 1"},
        "teams": {"home": {"id": 1, "name": home}, "away": {"id": 2, "name": away}},
        "goals": {"home": 2 if status == "FT" else None, "away": 1 if status == "FT" else None},
        "score": {"fulltime": {"home": 2, "away": 1}},
    }


class FakeApiClient:
    def __init__(self, pages: list[dict[str, Any]]) -> None:
        self.pages = pages
        self.requests_count = 0
        self.last_quota = None

    def fixtures(self, params: dict[str, Any]):
        from predigol_model.api_football_importer import ApiFootballFetchResult

        self.requests_count += len(self.pages)
        rows = [row for page in self.pages for row in page.get("response", [])]
        return ApiFootballFetchResult(rows=rows, raw_count=len(rows), requests_count=len(self.pages))

    def list_leagues(self, country=None):
        return []

    def seasons_for_league(self, league):
        return [2025]

    def resolve_league_id(self, league_name, season=None, country=None):
        return 239


class FakeExternalApi:
    def __init__(self) -> None:
        self.provider = "api_football"
        self.client = FakeApiClient([{"response": [fixture(900)]}])
        self.importer = ApiFootballImporter(self.client)


class ApiFootballImporterTests(unittest.TestCase):
    def test_normalizes_api_fixture_and_alias(self) -> None:
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture()]}]), TeamNormalizer([TeamAlias("América de Cali", "America de Cali")]))
        result, fetched = importer.import_season(239, 2025)

        self.assertEqual(fetched.raw_count, 1)
        self.assertEqual(len(result.valid), 1)
        self.assertEqual(result.valid[0]["api_football_fixture_id"], 100)
        self.assertEqual(result.valid[0]["local_nombre"], "América de Cali")
        self.assertEqual(result.valid[0]["origen_datos"], "api_football")
        internal = result.valid[0]["payload_api"]["internal_match"]
        self.assertEqual(internal["external_match_id"], "100")
        self.assertEqual(internal["provider"], "api-football")
        self.assertEqual(internal["league_id"], 239)
        self.assertEqual(internal["home_team"], "América de Cali")

    def test_empty_api_response_is_dry_run_safe(self) -> None:
        importer = ApiFootballImporter(FakeApiClient([{"response": []}]))
        result, fetched = importer.import_season(239, 2025)

        self.assertEqual(fetched.raw_count, 0)
        self.assertEqual(result.valid, [])

    def test_incomplete_fixture_is_rejected(self) -> None:
        with self.assertRaises(Exception):
            fixture_to_import_row({"fixture": {"date": "2025-01-01T00:00:00+00:00"}})

    def test_duplicate_by_api_id_and_fallback(self) -> None:
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture(100), fixture(100), fixture(101)]}]))
        result, _ = importer.import_season(239, 2025)

        self.assertEqual(len(result.valid), 1)
        self.assertEqual(len(result.duplicates), 2)

    def test_imported_dataset_quality_detects_duplicates_and_mixed_seasons(self) -> None:
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture(500), fixture(501, date="2026-01-01T20:00:00+00:00")]}]))
        result, _ = importer.import_season(239, 2025)
        result.valid[1]["payload_api"]["internal_match"]["external_match_id"] = result.valid[0]["payload_api"]["internal_match"]["external_match_id"]
        result.valid[1]["api_football_fixture_id"] = result.valid[0]["api_football_fixture_id"]
        result.valid[1]["temporada"] = 2026

        quality = validate_imported_dataset(result.valid, expected_season=2025)

        self.assertEqual(quality["status"], "invalid")
        self.assertFalse(quality["valid_for_training"])
        self.assertTrue(any("duplicado" in error for error in quality["errors"]))
        self.assertTrue(any("Temporadas mezcladas" in error for error in quality["errors"]))

    def test_upcoming_can_be_synced_when_requested(self) -> None:
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture(200, status="NS")]}]))
        result, _ = importer.import_season(239, 2025, include_upcoming=True)

        self.assertEqual(len(result.valid), 1)
        self.assertEqual(result.valid[0]["estado"], "proximo")
        self.assertIsNone(result.valid[0]["goles_local_final"])

    def test_same_match_from_csv_and_api_is_omitted_by_fallback(self) -> None:
        client = FakeSupabaseClient()
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture(300)]}]))
        api_result, _ = importer.import_season(239, 2025)
        csv_result = api_result
        csv_result.valid[0]["api_football_fixture_id"] = -999
        confirm_import(client, Path("manual.csv"), "CSV", csv_result, Path("reports/csv.json"))

        api_result, _ = importer.import_season(239, 2025)
        confirmation = confirm_import(client, Path("api"), "API", api_result, Path("reports/api.json"), source_type="api", source_name="api-football")

        self.assertEqual(confirmation["existing_count"], 1)

    def test_confirm_import_registers_api_dataset_and_run(self) -> None:
        client = FakeSupabaseClient()
        importer = ApiFootballImporter(FakeApiClient([{"response": [fixture(400)]}]))
        result, _ = importer.import_season(239, 2025)

        confirmation = confirm_import(client, Path("api"), "API", result, Path("reports/api.json"), source_type="api", source_name="api-football", run_type="api_import")

        self.assertEqual(confirmation["dataset"]["source_type"], "api")
        self.assertEqual(client.runs[-1]["run_type"], "api_import")

    def test_no_api_key_in_output(self) -> None:
        secret = "super-secret-token"
        stream = io.StringIO()
        with redirect_stdout(stream):
            print("API_FOOTBALL_KEY configurada sin mostrar valor")
        self.assertNotIn(secret, stream.getvalue())

    def test_csv_importer_still_works(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "season.csv"
            path.write_text(
                "fecha,torneo,temporada,local,visitante,goles_local,goles_visitante,estado\n"
                "2025-01-01T20:00:00+00:00,Liga BetPlay,2025,America de Cali,Cali,2,1,finalizado\n",
                encoding="utf-8",
            )

            result = load_and_validate(path)

        self.assertEqual(len(result.valid), 1)
        self.assertEqual(result.valid[0]["estado"], "finalizado")

    def test_api_cli_dry_run_does_not_save(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(importar_temporada_api, "REPORTS", Path(directory)):
                with patch.object(importar_temporada_api, "create_external_football_api", return_value=FakeExternalApi()):
                    with patch.object(importar_temporada_api, "confirm_import") as save_mock:
                        code = importar_temporada_api.main(["--provider", "api_football", "--league-id", "239", "--season", "2025", "--dry-run"])

        self.assertEqual(code, 0)
        save_mock.assert_not_called()

    def test_api_cli_save_local_writes_dataset_without_supabase(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            with patch.object(importar_temporada_api, "create_external_football_api", return_value=FakeExternalApi()):
                with patch.object(importar_temporada_api, "confirm_import") as save_mock:
                    code = importar_temporada_api.main([
                        "--provider",
                        "api_football",
                        "--league-id",
                        "239",
                        "--season",
                        "2025",
                        "--save-local",
                        "--output",
                        str(reports),
                    ])

            dataset_path = reports / "api_api_football_liga-239_temporada-2025_dataset.json"
            dataset_exists = dataset_path.exists()

        self.assertEqual(code, 0)
        self.assertTrue(dataset_exists)
        save_mock.assert_not_called()

    def test_api_cli_save_without_supabase_is_clear(self) -> None:
        stream = io.StringIO()
        with patch.object(importar_temporada_api, "load_settings", side_effect=RuntimeError("Missing SUPABASE_URL")):
            with redirect_stdout(stream):
                code = importar_temporada_api.main(["--provider", "api_football", "--league-id", "239", "--season", "2025", "--save"])

        self.assertEqual(code, 1)
        self.assertIn("--save guarda en Supabase", stream.getvalue())
        self.assertIn("--save-local", stream.getvalue())

    def test_api_cli_fails_clearly_without_api_key(self) -> None:
        stream = io.StringIO()
        with patch.object(importar_temporada_api, "create_external_football_api", side_effect=RuntimeError("Missing FOOTBALL_API_KEY")):
            with redirect_stdout(stream):
                code = importar_temporada_api.main(["--provider", "api_football", "--league-id", "239", "--season", "2025", "--dry-run"])

        self.assertEqual(code, 1)
        self.assertIn("Missing FOOTBALL_API_KEY", stream.getvalue())


class ApiFootballClientHttpTests(unittest.TestCase):
    def test_fixtures_does_not_send_page_param(self) -> None:
        sent_params: list[dict[str, Any]] = []

        def fake_get(url, params=None, headers=None, timeout=None):
            sent_params.append(dict(params or {}))
            payload = {"response": [fixture(1)], "errors": {}}
            return httpx.Response(200, json=payload, headers={}, request=httpx.Request("GET", url))

        with patch("predigol_model.api_football_importer.httpx.get", fake_get):
            client = ApiFootballClient("key", sleep_seconds=0)
            fetched = client.fixtures({"league": 239, "season": 2025})

        self.assertEqual(sent_params, [{"league": 239, "season": 2025}])
        self.assertNotIn("page", sent_params[0])
        self.assertEqual(fetched.raw_count, 1)

    def test_api_errors_include_context_without_secret(self) -> None:
        secret = "super-secret-key"

        def fake_get(url, params=None, headers=None, timeout=None):
            payload = {"response": [], "errors": {"page": "The Page field do not exist."}}
            return httpx.Response(200, json=payload, headers={}, request=httpx.Request("GET", url))

        with patch("predigol_model.api_football_importer.httpx.get", fake_get):
            with self.assertRaises(ApiFootballError) as context:
                ApiFootballClient(secret).fixtures({"league": 39, "season": 2024, "api_key": secret})

        message = str(context.exception)
        self.assertIn("/fixtures", message)
        self.assertIn("page", message)
        self.assertIn("api_key", message)
        self.assertNotIn(secret, message)

    def test_authentication_error(self) -> None:
        with patch("predigol_model.api_football_importer.httpx.get", return_value=httpx.Response(401, json={}, request=httpx.Request("GET", "https://x"))):
            with self.assertRaises(ApiFootballAuthError):
                ApiFootballClient("key").status()

    def test_rate_limit_error(self) -> None:
        with patch("predigol_model.api_football_importer.httpx.get", return_value=httpx.Response(429, json={}, request=httpx.Request("GET", "https://x"))):
            with self.assertRaises(ApiFootballRateLimitError):
                ApiFootballClient("key").status()

    def test_retries_temporary_failure(self) -> None:
        calls = {"count": 0}

        def fake_get(url, params=None, headers=None, timeout=None):
            calls["count"] += 1
            if calls["count"] == 1:
                raise httpx.TransportError("temporary")
            return httpx.Response(200, json={"response": [], "errors": {}}, request=httpx.Request("GET", url))

        with patch("predigol_model.api_football_importer.httpx.get", fake_get), patch("predigol_model.api_football_importer.time.sleep", lambda _: None):
            ApiFootballClient("key").status()

        self.assertEqual(calls["count"], 2)


if __name__ == "__main__":
    unittest.main()

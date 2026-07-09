from __future__ import annotations

import unittest
from pathlib import Path
from typing import Any

from predigol_model.importers import validate_and_normalize_rows
from predigol_model.team_normalization import TeamAlias, TeamNormalizer

from scripts.importar_temporada import confirm_import


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
        return [
            {"api_football_fixture_id": fixture_id}
            for fixture_id in fixture_ids
            if fixture_id in self.partidos
        ]

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> list[dict[str, Any]]:
        if table == "partidos":
            for row in rows:
                self.partidos[int(row[on_conflict])] = dict(row)
            return [dict(row) for row in rows]
        if table == "model_datasets":
            row = dict(rows[0])
            checksum = row[on_conflict]
            existing = self.datasets.get(checksum, {})
            stored = {**existing, **row, "id": existing.get("id", f"dataset-{len(self.datasets) + 1}")}
            self.datasets[checksum] = stored
            return [stored]
        raise AssertionError(f"Unexpected upsert table: {table}")

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        if table != "model_runs":
            raise AssertionError(f"Unexpected insert table: {table}")
        stored = {**row, "id": f"run-{len(self.runs) + 1}"}
        self.runs.append(stored)
        return stored


class ImporterTests(unittest.TestCase):
    def test_validates_and_normalizes_rows(self) -> None:
        normalizer = TeamNormalizer([TeamAlias("América de Cali", "America de Cali")])
        result = validate_and_normalize_rows([
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "America de Cali", "visitante": "Cali", "estado": "finalizado", "goles_local": "2", "goles_visitante": "1"}
        ], "test.csv", normalizer)
        self.assertEqual(len(result.valid), 1)
        self.assertEqual(result.valid[0]["local_nombre"], "América de Cali")

    def test_rejects_invalid_date_and_same_team(self) -> None:
        result = validate_and_normalize_rows([
            {"fecha": "mal", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "A", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
        ], "test.csv")
        self.assertEqual(len(result.discarded), 2)

    def test_detects_duplicates_and_incomplete_finished_result(self) -> None:
        rows = [
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-02 20:00", "torneo": "Liga", "temporada": "2024", "local": "C", "visitante": "D", "estado": "finalizado", "goles_local": "", "goles_visitante": "0"},
        ]
        result = validate_and_normalize_rows(rows, "test.csv")
        self.assertEqual(len(result.valid), 1)
        self.assertEqual(len(result.duplicates), 1)
        self.assertEqual(len(result.discarded), 2)

    def test_fallback_deduplicates_alias_variants_of_same_match(self) -> None:
        normalizer = TeamNormalizer([TeamAlias("América de Cali", "America de Cali")])
        rows = [
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "America de Cali", "visitante": "Cali", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "América de Cali", "visitante": "Cali", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
        ]

        result = validate_and_normalize_rows(rows, "test.csv", normalizer)

        self.assertEqual(len(result.valid), 1)
        self.assertEqual(len(result.duplicates), 1)
        self.assertIn("fallback", result.duplicates[0].reason)

    def test_does_not_deduplicate_same_teams_on_different_dates_or_tournaments(self) -> None:
        rows = [
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-02 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "2", "goles_visitante": "0"},
            {"fecha": "2024-01-01 20:00", "torneo": "Copa", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "3", "goles_visitante": "0"},
        ]

        result = validate_and_normalize_rows(rows, "test.csv")

        self.assertEqual(len(result.valid), 3)
        self.assertEqual(len(result.duplicates), 0)

    def test_external_identifier_has_priority_over_fallback(self) -> None:
        rows = [
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0", "external_id": "EXT-1"},
        ]
        result = validate_and_normalize_rows(rows, "test.csv")

        self.assertEqual(result.valid[0]["payload_api"]["import_identity"]["type"], "external_id")
        self.assertLess(result.valid[0]["api_football_fixture_id"], 0)

    def test_confirm_import_is_idempotent_for_matches_and_datasets(self) -> None:
        rows = [
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
            {"fecha": "2024-01-02 20:00", "torneo": "Liga", "temporada": "2024", "local": "C", "visitante": "D", "estado": "finalizado", "goles_local": "2", "goles_visitante": "2"},
        ]
        result = validate_and_normalize_rows(rows, "manual-data/test.csv")
        client = FakeSupabaseClient()
        path = Path("manual-data/test.csv")

        first = confirm_import(client, path, "Temporada test", result, Path("reports/test.json"))
        second = confirm_import(client, path, "Temporada test", result, Path("reports/test.json"))

        self.assertEqual(len(client.partidos), 2)
        self.assertEqual(len(client.datasets), 1)
        self.assertEqual(len(client.runs), 2)
        self.assertEqual(first["existing_count"], 0)
        self.assertEqual(second["existing_count"], 2)
        self.assertEqual(client.runs[-1]["metrics"]["existing_matches"], 2)
        self.assertEqual(client.runs[-1]["metrics"]["inserted_matches"], 0)
        self.assertEqual(client.partidos[result.valid[0]["api_football_fixture_id"]]["payload_api"]["raw"], rows[0])

    def test_confirm_import_omits_same_match_from_different_source_by_fallback(self) -> None:
        first = validate_and_normalize_rows([
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
        ], "source-a.csv")
        second = validate_and_normalize_rows([
            {"fecha": "2024-01-01 20:00", "torneo": "Liga", "temporada": "2024", "local": "A", "visitante": "B", "estado": "finalizado", "goles_local": "1", "goles_visitante": "0"},
        ], "source-b.csv")
        client = FakeSupabaseClient()

        confirm_import(client, Path("source-a.csv"), "A", first, Path("reports/a.json"))
        confirmation = confirm_import(client, Path("source-b.csv"), "B", second, Path("reports/b.json"))

        self.assertEqual(len(client.partidos), 1)
        self.assertEqual(confirmation["existing_count"], 1)
        self.assertEqual(client.runs[-1]["metrics"]["omitted_existing_matches"], 1)


if __name__ == "__main__":
    unittest.main()

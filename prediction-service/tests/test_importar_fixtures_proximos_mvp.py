from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from scripts import importar_fixtures_proximos_mvp as importer


NOW = datetime(2026, 7, 14, tzinfo=timezone.utc)


def valid_raw(fixture_id: int = 991001, kickoff: str = "2026-07-20T20:00:00+00:00", status_short: str = "NS") -> dict[str, object]:
    return {
        "fixture": {"id": fixture_id, "date": kickoff, "timezone": "UTC", "status": {"short": status_short, "long": "Not Started"}},
        "league": {"id": 239, "name": "Liga BetPlay", "season": 2026, "round": "Clausura - 1"},
        "teams": {"home": {"id": 10, "name": "America de Cali"}, "away": {"id": 11, "name": "Deportivo Cali"}},
        "source_url": "https://v3.football.api-sports.io/fixtures?league=239&season=2026&next=1",
    }


class FakeClient:
    def __init__(self, existing: dict[int, dict[str, object]] | None = None, fail_table: str | None = None) -> None:
        self.existing = existing or {}
        self.fail_table = fail_table
        self.writes: list[tuple[str, list[dict[str, object]]]] = []

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, object]]:
        if table != "football_fixtures":
            return []
        raw_ids = params.get("api_football_fixture_id", "in.()").removeprefix("in.(").removesuffix(")")
        ids = [int(item) for item in raw_ids.split(",") if item]
        return [self.existing[item] for item in ids if item in self.existing]

    def upsert(self, table: str, rows: list[dict[str, object]], on_conflict: str) -> list[dict[str, object]]:
        if table == self.fail_table:
            raise RuntimeError("supabase partial failure")
        self.writes.append((table, rows))
        return rows


class ImportarFixturesProximosTests(unittest.TestCase):
    def test_dry_run_no_write(self) -> None:
        client = FakeClient()
        candidate = importer.candidate_from_api_football(valid_raw(), "api-football")
        plan = importer.build_plan([candidate], client, limit=1, now=NOW)

        self.assertEqual(plan[0].operation, "insert")
        self.assertEqual(client.writes, [])

    def test_valid_future_fixture(self) -> None:
        candidate = importer.candidate_from_api_football(valid_raw(), "api-football")

        self.assertEqual(importer.validate_candidate(candidate, now=NOW), [])

    def test_past_date_rejected(self) -> None:
        candidate = importer.candidate_from_api_football(valid_raw(kickoff="2026-07-01T20:00:00+00:00"), "api-football")

        self.assertIn("fecha pasada o no futura", importer.validate_candidate(candidate, now=NOW))

    def test_finished_fixture_rejected(self) -> None:
        candidate = importer.candidate_from_api_football(valid_raw(status_short="FT"), "api-football")

        errors = importer.validate_candidate(candidate, now=NOW)

        self.assertIn("partido finalizado rechazado", errors)

    def test_duplicate_identifier(self) -> None:
        candidate = importer.candidate_from_api_football(valid_raw(), "api-football")
        plan = importer.build_plan([candidate, candidate], FakeClient(), limit=2, now=NOW)

        self.assertTrue(all("identificador duplicado en la fuente" in item.errors for item in plan))

    def test_missing_identifier(self) -> None:
        raw = valid_raw()
        raw["fixture"] = {**raw["fixture"], "id": ""}  # type: ignore[index]
        candidate = importer.candidate_from_api_football(raw, "api-football")

        self.assertIn("identificador API-Football vacio, invalido o ficticio", importer.validate_candidate(candidate, now=NOW))

    def test_incomplete_teams(self) -> None:
        raw = valid_raw()
        raw["teams"] = {"home": {"id": 10, "name": "America de Cali"}, "away": {"id": 11, "name": ""}}
        candidate = importer.candidate_from_api_football(raw, "api-football")

        self.assertIn("equipos incompletos", importer.validate_candidate(candidate, now=NOW))

    def test_max_limit(self) -> None:
        candidates = [importer.candidate_from_api_football(valid_raw(991000 + index), "api-football") for index in range(3)]
        plan = importer.build_plan(candidates, FakeClient(), limit=2, now=NOW)

        self.assertEqual(len(plan), 2)

    def test_partial_supabase_error(self) -> None:
        candidate = importer.candidate_from_api_football(valid_raw(), "api-football")
        plan = importer.build_plan([candidate], FakeClient(), limit=1, now=NOW)
        summary = importer.apply_plan(plan, FakeClient(fail_table="football_fixtures"))

        self.assertEqual(summary.inserted, 0)
        self.assertEqual(summary.errors, 1)
        self.assertEqual(summary.supabase_errors, ["RuntimeError"])

    def test_secret_not_printed(self) -> None:
        secret = "super-secret-api-key"
        stream = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixtures.json"
            path.write_text(json.dumps({"response": [valid_raw()]}), encoding="utf-8")
            with patch.object(importer, "load_settings", side_effect=RuntimeError(secret)):
                with redirect_stdout(stream):
                    code = importer.main(["--dry-run", "--source", str(path)])

        self.assertEqual(code, 0)
        self.assertNotIn(secret, stream.getvalue())

    def test_quota_counter_is_coherent(self) -> None:
        summary = importer.quota_summary(0)

        self.assertEqual(summary["api_football_requests_this_script"], 0)
        self.assertIn("No se declara cuota 0", summary["api_football_quota_note"])


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from scripts import importar_fixtures_proximos_mvp as fixture_importer
from scripts import verificar_acceso_api_football as preflight


NOW = datetime(2026, 7, 14, tzinfo=timezone.utc)


def settings() -> SimpleNamespace:
    return SimpleNamespace(api_key="secret-token", base_url="https://v3.football.api-sports.io", timeout_seconds=20)


def response(payload: dict, status_code: int = 200, headers: dict[str, str] | None = None) -> httpx.Response:
    return httpx.Response(status_code, json=payload, headers=headers or {})


def fixture(fixture_id: int = 100, date: str = "2026-07-20T20:00:00+00:00", status: str = "NS") -> dict:
    return {
        "fixture": {"id": fixture_id, "date": date, "timezone": "UTC", "status": {"short": status, "long": "Not Started"}},
        "league": {"id": 140, "name": "La Liga", "season": 2025},
        "teams": {"home": {"id": 1, "name": "Real Madrid"}, "away": {"id": 2, "name": "Barcelona"}},
    }


class AccessPreflightTests(unittest.TestCase):
    def args(self, **overrides):
        values = {"league": 140, "season": 2025, "next": 3, "date_from": None, "date_to": None, "dry_run": True}
        values.update(overrides)
        return SimpleNamespace(**values)

    def run_preflight(self, payload: dict, status_code: int = 200):
        with patch.object(preflight, "load_football_api_settings", return_value=settings()):
            return preflight.preflight(self.args(), getter=lambda *a, **k: response(payload, status_code), now=NOW)

    def test_access_allowed(self) -> None:
        result = self.run_preflight({"errors": {}, "response": [fixture()]})

        self.assertEqual(result.status, "access_allowed")
        self.assertEqual(result.future_fixtures, 1)

    def test_season_not_in_plan(self) -> None:
        result = self.run_preflight({"errors": {"plan": "Free plans do not have access to this season, try from 2022 to 2024."}, "response": []})

        self.assertEqual(result.status, "season_not_in_plan")

    def test_invalid_key(self) -> None:
        result = self.run_preflight({"message": "forbidden"}, status_code=403)

        self.assertEqual(result.status, "invalid_key")

    def test_quota_exhausted(self) -> None:
        result = self.run_preflight({"errors": {"rateLimit": "Too many requests"}, "response": []})

        self.assertEqual(result.status, "quota_exhausted")

    def test_valid_zero_fixtures(self) -> None:
        result = self.run_preflight({"errors": {}, "response": []})

        self.assertEqual(result.status, "valid_zero_fixtures")
        self.assertEqual(result.raw_count, 0)

    def test_future_fixture_real(self) -> None:
        result = self.run_preflight({"errors": {}, "response": [fixture()]})

        self.assertTrue(result.fixtures[0]["valid_future_fixture"])
        self.assertEqual(result.fixtures[0]["api_football_fixture_id"], 100)

    def test_past_fixture_rejected(self) -> None:
        result = self.run_preflight({"errors": {}, "response": [fixture(date="2026-07-01T20:00:00+00:00")]})

        self.assertEqual(result.future_fixtures, 0)
        self.assertIn("fixture pasado", result.fixtures[0]["reasons"])

    def test_requests_counter(self) -> None:
        result = self.run_preflight({"errors": {}, "response": []})

        self.assertEqual(result.requests_count, 1)

    def test_dry_run_no_write(self) -> None:
        stream = io.StringIO()
        with patch.object(preflight, "load_football_api_settings", return_value=settings()):
            with patch.object(preflight.httpx, "get", return_value=response({"errors": {}, "response": []})):
                with redirect_stdout(stream):
                    code = preflight.main(["--dry-run"])

        self.assertEqual(code, 0)
        self.assertIn('"mode": "dry-run"', stream.getvalue())

    def test_max_query_limit(self) -> None:
        with self.assertRaises(ValueError):
            preflight.validate_args(self.args(next=preflight.MAX_NEXT + 1))

    def test_secret_not_printed(self) -> None:
        stream = io.StringIO()
        with patch.object(preflight, "load_football_api_settings", return_value=settings()):
            with patch.object(preflight.httpx, "get", return_value=response({"errors": {}, "response": []})):
                with redirect_stdout(stream):
                    preflight.main(["--dry-run"])

        self.assertNotIn("secret-token", stream.getvalue())

    def test_network_error(self) -> None:
        with patch.object(preflight, "load_football_api_settings", return_value=settings()):
            result = preflight.preflight(self.args(), getter=lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("boom")), now=NOW)

        self.assertEqual(result.status, "network_error")

    def test_malformed_response(self) -> None:
        with patch.object(preflight, "load_football_api_settings", return_value=settings()):
            result = preflight.preflight(self.args(), getter=lambda *a, **k: httpx.Response(200, content=b"{"), now=NOW)

        self.assertEqual(result.status, "malformed_response")

    def test_import_idempotent_existing_fixture(self) -> None:
        candidate = fixture_importer.candidate_from_api_football(fixture(), "api-football")
        existing = {
            100: {
                "api_football_fixture_id": 100,
                "kickoff_at": "2026-07-20T20:00:00+00:00",
                "home_team_api_id": 1,
                "away_team_api_id": 2,
                "status": "proximo",
                "status_short": "NS",
            }
        }

        class Client:
            def select(self, table, params):
                return list(existing.values())

        plan = fixture_importer.build_plan([candidate], Client(), limit=1, now=NOW)

        self.assertEqual(plan[0].operation, "omit")
        self.assertEqual(plan[0].reason, "duplicado existente consistente")


if __name__ == "__main__":
    unittest.main()

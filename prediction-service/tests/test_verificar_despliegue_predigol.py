from __future__ import annotations

import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts import verificar_despliegue_predigol as deploy


class FakeSupabaseClient:
    def __init__(self, *, fail: bool = False, predictions: int = 0, fixtures: int = 0) -> None:
        self.fail = fail
        self.predictions = predictions
        self.fixtures = fixtures

    def count(self, table: str, params: dict[str, str] | None = None) -> int:
        if self.fail:
            raise RuntimeError("offline")
        if table == "model_predictions":
            return self.predictions
        if table == "football_fixtures":
            return self.fixtures
        if table == "partidos":
            return self.fixtures
        return 1

    def select(self, table: str, params: dict[str, str]):
        if self.fail:
            raise RuntimeError("offline")
        return []

    def rpc(self, function_name: str, payload: dict | None = None):
        if self.fail:
            raise RuntimeError("offline")
        return [] if function_name == "obtener_predicciones_visibles" else {}


def make_root(with_package: bool = True) -> Path:
    root = Path(tempfile.mkdtemp())
    paths = [
        "predigol-web/package-lock.json",
        "predigol-web/vite.config.js",
        "predigol-web/src/App.jsx",
        "prediction-service/pyproject.toml",
        "prediction-service/requirements.txt",
        "scripts/publicar_predicciones_v1_mvp.py",
        "scripts/importar_fixtures_proximos_mvp.py",
        "scripts/verificar_acceso_api_football.py",
        "supabase/migrations/202607100001_freemium_premium_access.sql",
    ]
    if with_package:
        paths.append("predigol-web/package.json")
    for item in paths:
        path = root / item
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{}", encoding="utf-8")
    return root


class DeploymentPreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env_patch = patch.dict(
            os.environ,
            {
                "VITE_SUPABASE_URL": "https://example.supabase.co",
                "VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_placeholder",
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": deploy.SUPABASE_SECRET_PREFIX + "placeholder_for_tests",
            },
            clear=False,
        )
        self.env_patch.start()
        self.git_patch = patch.object(deploy, "git_files", return_value=[])
        self.git_patch.start()

    def tearDown(self) -> None:
        self.git_patch.stop()
        self.env_patch.stop()

    def test_complete_configuration(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient(predictions=1, fixtures=1))

        self.assertTrue(report.frontend_ready)
        self.assertTrue(report.authenticated_ready)

    def test_missing_required_variable(self) -> None:
        with patch.dict(os.environ, {"VITE_SUPABASE_URL": ""}, clear=False):
            report = deploy.build_report(make_root(), client=FakeSupabaseClient())

        check = next(item for item in report.checks if item.name == "env_VITE_SUPABASE_URL")
        self.assertEqual(check.status, "PENDIENTE CONFIGURACION")

    def test_secret_in_vite_variable(self) -> None:
        with patch.dict(os.environ, {"VITE_SUPABASE_PUBLISHABLE_KEY": deploy.SUPABASE_SECRET_PREFIX + "bad"}, clear=False):
            report = deploy.build_report(make_root(), client=FakeSupabaseClient())

        check = next(item for item in report.checks if item.name == "vite_secret_scan_env")
        self.assertEqual(check.status, "BLOQUEADO")

    def test_missing_package_json(self) -> None:
        report = deploy.build_report(make_root(with_package=False), client=FakeSupabaseClient())

        check = next(item for item in report.checks if item.name == "frontend_package")
        self.assertEqual(check.status, "BLOQUEADO")

    def test_fixture_source_blocked(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient())

        check = next(item for item in report.checks if item.name == "api_football_preflight")
        self.assertEqual(check.status, "BLOQUEADO")

    def test_zero_predictions_not_critical(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient(predictions=0, fixtures=0))

        check = next(item for item in report.checks if item.name == "predicciones_modelo")
        self.assertEqual(check.status, "ADVERTENCIA")
        self.assertFalse(report.live_predictions_ready)

    def test_supabase_unavailable(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient(fail=True))

        check = next(item for item in report.checks if item.name == "supabase_conexion")
        self.assertEqual(check.status, "ADVERTENCIA")

    def test_secrets_not_printed(self) -> None:
        stream = io.StringIO()
        with patch.object(deploy, "build_report", return_value=deploy.build_report(make_root(), client=FakeSupabaseClient())):
            with redirect_stdout(stream):
                deploy.main()

        self.assertNotIn(deploy.SUPABASE_SECRET_PREFIX + "placeholder_for_tests", stream.getvalue())

    def test_frontend_ready_result(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient(predictions=0, fixtures=0))

        self.assertTrue(report.frontend_ready)

    def test_live_data_blocked_result(self) -> None:
        report = deploy.build_report(make_root(), client=FakeSupabaseClient(predictions=0, fixtures=0))

        self.assertFalse(report.live_predictions_ready)
        self.assertTrue(any("predicciones en vivo" in action for action in report.pending_actions))


if __name__ == "__main__":
    unittest.main()

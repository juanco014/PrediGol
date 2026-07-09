from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from predigol_model.preflight import build_preflight, format_preflight


class PreflightTests(unittest.TestCase):
    def test_preflight_without_env_is_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            root = Path(directory)
            (root / "prediction-service").mkdir()
            items, conclusion = build_preflight(root)

        self.assertTrue(any(item.category == "Archivo .env" and item.status == "BLOQUEADO" for item in items))
        self.assertIn("faltan credenciales", conclusion)

    def test_preflight_with_empty_supabase_env_is_blocked_without_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            root = Path(directory)
            service = root / "prediction-service"
            service.mkdir()
            (service / ".env").write_text("SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\n", encoding="utf-8")
            items, conclusion = build_preflight(root)
            output = format_preflight(items, conclusion)

        self.assertIn("SUPABASE_URL", output)
        self.assertIn("BLOQUEADO", output)
        self.assertNotIn("tu_service_role_key", output)


if __name__ == "__main__":
    unittest.main()

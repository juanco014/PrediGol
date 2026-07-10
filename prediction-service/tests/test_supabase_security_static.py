from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class SupabaseSecurityStaticTests(unittest.TestCase):
    def test_admin_rpcs_validate_admin_role(self) -> None:
        migration = (ROOT / "supabase/migrations/202607060002_model_runs_datasets_team_aliases.sql").read_text(encoding="utf-8")

        for function_name in ["obtener_model_admin_summary", "guardar_team_alias", "actualizar_estado_team_alias"]:
            self.assertIn(f"function public.{function_name}", migration)
        self.assertGreaterEqual(migration.count("if not public.predigol_es_admin() then"), 3)
        self.assertGreaterEqual(migration.count("security definer"), 3)
        self.assertGreaterEqual(migration.count("set search_path = public"), 3)

    def test_model_admin_writes_are_revoked_from_authenticated(self) -> None:
        migration = (ROOT / "supabase/migrations/202607060004_lock_model_admin_writes.sql").read_text(encoding="utf-8")

        for table in ["model_datasets", "model_runs", "team_aliases"]:
            self.assertIn(f"alter table public.{table} enable row level security", migration)
            self.assertIn(f"revoke insert, update, delete on public.{table} from anon, authenticated", migration)

    def test_frontend_does_not_use_service_role_key(self) -> None:
        frontend = ROOT / "predigol-web/src"
        matches = []
        for path in frontend.rglob("*"):
            if path.is_file():
                text = path.read_text(encoding="utf-8", errors="ignore")
                if "SUPABASE_SERVICE_ROLE_KEY" in text or "SERVICE_ROLE" in text:
                    matches.append(path)
        self.assertEqual(matches, [])

    def test_freemium_predictions_use_rls_and_secure_rpcs(self) -> None:
        migration = (ROOT / "supabase/migrations/202607100001_freemium_premium_access.sql").read_text(encoding="utf-8")

        for table in ["subscription_plans", "user_subscriptions"]:
            self.assertIn(f"alter table public.{table} enable row level security", migration)
        for function_name in ["obtener_predicciones_visibles", "obtener_prediccion_visible", "obtener_plan_usuario"]:
            self.assertIn(f"function public.{function_name}", migration)
        self.assertIn("drop policy if exists \"model_predictions_read_authenticated\"", migration)
        self.assertIn("create policy \"model_predictions_read_by_entitlement\"", migration)
        self.assertIn("case when v_can_access then p_prediction.home_win_probability else null end", migration)
        self.assertIn("revoke insert, update, delete on public.user_subscriptions from anon, authenticated", migration)


if __name__ == "__main__":
    unittest.main()

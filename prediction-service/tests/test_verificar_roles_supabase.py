from __future__ import annotations

import io
import unittest
from contextlib import redirect_stdout
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from scripts import verificar_roles_supabase


@dataclass
class FakeResponse:
    status_code: int
    data: Any = None
    text: str = ""

    def __post_init__(self) -> None:
        if not self.text and self.data is not None:
            self.text = "json"

    def json(self) -> Any:
        if self.data is None:
            raise ValueError("sin json")
        return self.data


class FakeAuthClient:
    response = FakeResponse(200, {"access_token": "token-free", "user": {"id": "user-free"}})
    requests: list[tuple[str, str]] = []

    def __init__(self, **_kwargs: Any) -> None:
        pass

    def __enter__(self) -> "FakeAuthClient":
        return self

    def __exit__(self, *_args: Any) -> None:
        pass

    def post(self, path: str, content: str) -> FakeResponse:
        self.requests.append((path, content))
        return self.response


class FakeRestClient:
    def __init__(self, *, premium_exists: bool = True, admin: bool = False, premium: bool = False, unexpected: bool = False) -> None:
        self.premium_exists = premium_exists
        self.admin = admin
        self.premium = premium
        self.unexpected = unexpected
        self.posts: list[tuple[str, str]] = []

    def __enter__(self) -> "FakeRestClient":
        return self

    def __exit__(self, *_args: Any) -> None:
        pass

    def post(self, path: str, content: str, headers: dict[str, str] | None = None) -> FakeResponse:
        self.posts.append((path, content))
        if self.unexpected:
            return FakeResponse(500, {"message": "unexpected supabase error"}, '{"message":"unexpected supabase error"}')
        if path.startswith("/rpc/predigol_es_admin"):
            return FakeResponse(200, self.admin, str(self.admin).lower())
        if path.startswith("/rpc/obtener_plan_usuario"):
            return FakeResponse(200, {"plan_code": "premium" if self.premium else "free", "status": "premium_active" if self.premium else "free", "is_premium": self.premium})
        if path.startswith("/rpc/predigol_usuario_tiene_premium"):
            return FakeResponse(200, self.premium or self.admin, str(self.premium or self.admin).lower())
        if path.startswith("/rpc/obtener_predicciones_visibles"):
            rows = []
            if self.premium_exists:
                rows.append({
                    "api_football_fixture_id": 10,
                    "partido_id": "p10",
                    "access_tier": "premium",
                    "is_locked": not (self.premium or self.admin),
                    "home_win_probability": 0.5 if (self.premium or self.admin) else None,
                    "draw_probability": 0.25 if (self.premium or self.admin) else None,
                    "away_win_probability": 0.25 if (self.premium or self.admin) else None,
                    "predicted_home_goals": 2 if (self.premium or self.admin) else None,
                    "predicted_away_goals": 1 if (self.premium or self.admin) else None,
                    "confidence": 0.7 if (self.premium or self.admin) else None,
                })
            return FakeResponse(200, rows)
        if path.startswith("/rpc/obtener_prediccion_visible"):
            return FakeResponse(200, {"api_football_fixture_id": 10, "access_tier": "premium", "is_locked": not (self.premium or self.admin)})
        if path in {"/model_runs", "/model_datasets", "/team_aliases"}:
            return FakeResponse(403, {"message": "permission denied"}, '{"message":"permission denied"}')
        return FakeResponse(404, {"message": "not found"}, '{"message":"not found"}')

    def get(self, path: str, params: dict[str, str]) -> FakeResponse:
        if self.unexpected:
            return FakeResponse(500, {"message": "unexpected supabase error"}, '{"message":"unexpected supabase error"}')
        if path == "/profiles":
            return FakeResponse(200, [{"id": "user", "rol": "admin" if self.admin else "usuario", "es_admin": self.admin}])
        if path == "/user_subscriptions":
            expires = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
            return FakeResponse(200, [{"plan_code": "premium", "status": "premium_active", "expires_at": expires}] if self.premium else [])
        if path == "/model_runs":
            return FakeResponse(200, [{"id": "run-1"}] if self.admin else [])
        return FakeResponse(200, [])


class VerificarRolesSupabaseTests(unittest.TestCase):
    def test_inicio_sesion_correcto(self) -> None:
        session, result = verificar_roles_supabase.sign_in("https://example.supabase.co", "anon", "gratis", "u@example.com", "secret", client_factory=FakeAuthClient)

        self.assertIsNotNone(session)
        self.assertEqual(result.status, "OK")

    def test_credenciales_ausentes(self) -> None:
        results = verificar_roles_supabase.missing_credentials("gratis", {})

        self.assertEqual(results[0].status, "PENDIENTE CREDENCIALES")
        self.assertIn("PREDIGOL_TEST_FREE_EMAIL", results[0].detail)

    def test_credenciales_incorrectas(self) -> None:
        class BadAuth(FakeAuthClient):
            response = FakeResponse(400, {"message": "Invalid login credentials"})

        session, result = verificar_roles_supabase.sign_in("https://example.supabase.co", "anon", "gratis", "u@example.com", "bad", client_factory=BadAuth)

        self.assertIsNone(session)
        self.assertEqual(result.status, "FALLO")

    def test_usuario_gratis(self) -> None:
        session = verificar_roles_supabase.AuthSession("gratis", "PREDIGOL_TEST_FREE_EMAIL", "user-free", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(), verificar_roles_supabase.ROLE_CONFIG["gratis"])

        statuses = {result.name: result.status for result in results}
        self.assertEqual(statuses["predigol_usuario_tiene_premium"], "OK")
        self.assertEqual(statuses["bloqueo_premium_listado"], "OK")
        self.assertEqual(statuses["detalle_premium_bloqueado"], "OK")

    def test_usuario_premium(self) -> None:
        session = verificar_roles_supabase.AuthSession("premium", "PREDIGOL_TEST_PREMIUM_EMAIL", "user-premium", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(premium=True), verificar_roles_supabase.ROLE_CONFIG["premium"])

        statuses = {result.name: result.status for result in results}
        self.assertEqual(statuses["predigol_usuario_tiene_premium"], "OK")
        self.assertEqual(statuses["suscripcion_activa"], "OK")
        self.assertEqual(statuses["detalle_premium_permitido"], "OK")

    def test_usuario_admin(self) -> None:
        session = verificar_roles_supabase.AuthSession("admin", "PREDIGOL_TEST_ADMIN_EMAIL", "user-admin", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(admin=True), verificar_roles_supabase.ROLE_CONFIG["admin"])

        statuses = {result.name: result.status for result in results}
        self.assertEqual(statuses["predigol_es_admin"], "OK")
        self.assertEqual(statuses["rol_admin_profile"], "OK")
        self.assertEqual(statuses["lectura_admin_model_runs"], "OK")

    def test_rpc_protegida_funciona_con_sesion(self) -> None:
        data, error = verificar_roles_supabase.rpc(FakeRestClient(), "obtener_plan_usuario")

        self.assertIsNone(error)
        self.assertEqual(data["plan_code"], "free")

    def test_prediccion_premium_inexistente(self) -> None:
        session = verificar_roles_supabase.AuthSession("gratis", "PREDIGOL_TEST_FREE_EMAIL", "user-free", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(premium_exists=False), verificar_roles_supabase.ROLE_CONFIG["gratis"])

        self.assertIn("PENDIENTE DATOS", [result.status for result in results])

    def test_permiso_administrativo_denegado(self) -> None:
        session = verificar_roles_supabase.AuthSession("gratis", "PREDIGOL_TEST_FREE_EMAIL", "user-free", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(), verificar_roles_supabase.ROLE_CONFIG["gratis"])

        admin_result = next(result for result in results if result.name == "lectura_admin_model_runs")
        self.assertEqual(admin_result.status, "OK")
        self.assertIn("cero filas", admin_result.detail)

    def test_permiso_administrativo_denegado_explica_error_si_rls_rechaza(self) -> None:
        class DeniedModelRunsClient(FakeRestClient):
            def get(self, path: str, params: dict[str, str]) -> FakeResponse:
                if path == "/model_runs":
                    return FakeResponse(403, {"message": "permission denied"}, '{"message":"permission denied"}')
                return super().get(path, params)

        session = verificar_roles_supabase.AuthSession("gratis", "PREDIGOL_TEST_FREE_EMAIL", "user-free", "token")
        results = verificar_roles_supabase.check_role(session, DeniedModelRunsClient(), verificar_roles_supabase.ROLE_CONFIG["gratis"])

        admin_result = next(result for result in results if result.name == "lectura_admin_model_runs")
        self.assertEqual(admin_result.status, "OK")
        self.assertIn("consulta denegada", admin_result.detail)

    def test_error_inesperado_supabase(self) -> None:
        session = verificar_roles_supabase.AuthSession("gratis", "PREDIGOL_TEST_FREE_EMAIL", "user-free", "token")
        results = verificar_roles_supabase.check_role(session, FakeRestClient(unexpected=True), verificar_roles_supabase.ROLE_CONFIG["gratis"])

        self.assertIn("FALLO", [result.status for result in results])

    def test_no_imprime_secretos(self) -> None:
        results = [
            verificar_roles_supabase.CheckResult("gratis", "credenciales", "PENDIENTE CREDENCIALES", "falta PREDIGOL_TEST_FREE_PASSWORD; no se muestra ningun secreto"),
        ]
        buffer = io.StringIO()

        with redirect_stdout(buffer):
            verificar_roles_supabase.print_results(results)

        output = buffer.getvalue().lower()
        self.assertNotIn("super-secret", output)
        self.assertNotIn("token-free", output)


if __name__ == "__main__":
    unittest.main()

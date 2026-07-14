from __future__ import annotations

import base64
import json
import unittest
from dataclasses import dataclass
from typing import Any

from scripts import verificar_supabase_mvp


def fake_jwt(role: str) -> str:
    def encode(payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    return f"{encode({'alg': 'HS256', 'typ': 'JWT'})}.{encode({'role': role})}.firma"


@dataclass
class FakeResponse:
    status_code: int
    text: str
    data: Any | None = None

    def json(self) -> Any:
        if self.data is None:
            raise ValueError("sin json")
        return self.data


class FakeClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.posts: list[tuple[str, str]] = []

    def post(self, path: str, content: str) -> FakeResponse:
        self.posts.append((path, content))
        return self.response

    def get(self, path: str, params: dict[str, str]) -> FakeResponse:
        return self.response


class VerificarSupabaseMvpTests(unittest.TestCase):
    def test_rpc_protegida_por_login_no_se_reporta_faltante(self) -> None:
        client = FakeClient(FakeResponse(400, '{"code":"P0001","message":"Debes iniciar sesion."}'))

        result = verificar_supabase_mvp.check_rpc(client, "obtener_predicciones_visibles", {"p_limit": 24})

        self.assertEqual(result.status, "PENDIENTE SESION")
        self.assertIn("requiere usuario autenticado", result.detail)

    def test_rpc_faltante_se_reporta_faltante(self) -> None:
        client = FakeClient(FakeResponse(404, '{"code":"PGRST202","message":"Could not find the function"}'))

        result = verificar_supabase_mvp.check_rpc(client, "obtener_plan_usuario", {})

        self.assertEqual(result.status, "FALTANTE")

    def test_rpc_sin_permisos_se_reporta_permisos_aunque_sea_http_400(self) -> None:
        client = FakeClient(FakeResponse(400, '{"code":"42501","message":"permission denied for function predigol_es_admin"}'))

        result = verificar_supabase_mvp.check_rpc(client, "predigol_es_admin", {})

        self.assertEqual(result.status, "PERMISOS")

    def test_rpc_ejecutable_se_reporta_ok(self) -> None:
        client = FakeClient(FakeResponse(200, "true"))

        result = verificar_supabase_mvp.check_rpc(client, "predigol_usuario_tiene_premium", {})

        self.assertEqual(result.status, "OK")

    def test_prediccion_visible_sin_fixture_no_falla_si_devuelve_null(self) -> None:
        client = FakeClient(FakeResponse(200, "null"))

        result = verificar_supabase_mvp.check_rpc(
            client,
            "obtener_prediccion_visible",
            {"p_api_football_fixture_id": 0},
            null_is_pending=True,
        )

        self.assertEqual(result.status, "PENDIENTE DATOS")

    def test_tabla_con_permiso_denegado_muestra_codigo_y_mensaje(self) -> None:
        client = FakeClient(FakeResponse(403, '{"code":"42501","message":"permission denied for table subscription_plans"}'))

        result = verificar_supabase_mvp.check_table(client, "subscription_plans")

        self.assertEqual(result.status, "PERMISOS")
        self.assertIn("HTTP 403", result.detail)
        self.assertIn("code=42501", result.detail)
        self.assertIn("permission denied for table subscription_plans", result.detail)

    def test_error_rls_se_distingue_de_permiso_general(self) -> None:
        status, detail = verificar_supabase_mvp.classify_error(
            403,
            '{"code":"42501","message":"new row violates row-level security policy for table user_subscriptions"}',
        )

        self.assertEqual(status, "RLS")
        self.assertIn("row-level security", detail)

    def test_clave_invalida_se_distingue_de_grant(self) -> None:
        status, detail = verificar_supabase_mvp.classify_error(
            401,
            '{"message":"Invalid API key"}',
        )

        self.assertEqual(status, "CLAVE")
        self.assertIn("Invalid API key", detail)

    def test_tabla_no_expuesta_rest_se_reporta_faltante_con_codigo(self) -> None:
        status, detail = verificar_supabase_mvp.classify_error(
            404,
            '{"code":"PGRST205","message":"Could not find the table public.subscription_plans in the schema cache"}',
        )

        self.assertEqual(status, "FALTANTE")
        self.assertIn("PGRST205", detail)

    def test_error_de_consulta_se_distingue(self) -> None:
        status, detail = verificar_supabase_mvp.classify_error(
            400,
            '{"code":"PGRST100","message":"failed to parse select parameter"}',
        )

        self.assertEqual(status, "CONSULTA")
        self.assertIn("PGRST100", detail)

    def test_headers_usan_service_role_en_apikey_y_authorization(self) -> None:
        headers = verificar_supabase_mvp.build_service_headers("service-secret")

        self.assertEqual(headers["apikey"], "service-secret")
        self.assertEqual(headers["Authorization"], "Bearer service-secret")

    def test_credencial_jwt_legacy_service_role_es_administrativa(self) -> None:
        status = verificar_supabase_mvp.validate_admin_credential(fake_jwt("service_role"))

        self.assertTrue(status.ok)
        self.assertIn("service_role", status.label)

    def test_credencial_jwt_legacy_anon_se_rechaza(self) -> None:
        status = verificar_supabase_mvp.validate_admin_credential(fake_jwt("anon"))

        self.assertFalse(status.ok)
        self.assertIn("anon/publishable", status.detail)

    def test_credencial_moderna_sb_secret_es_administrativa(self) -> None:
        status = verificar_supabase_mvp.validate_admin_credential("sb_secret_abc123")

        self.assertTrue(status.ok)
        self.assertIn("sb_secret", status.label)

    def test_credencial_publishable_en_service_role_se_rechaza(self) -> None:
        status = verificar_supabase_mvp.validate_admin_credential("sb_publishable_abc123")

        self.assertFalse(status.ok)
        self.assertIn("CONFIGURACION INCORRECTA", status.detail)
        self.assertIn("anon/publishable", status.detail)

    def test_cliente_administrativo_no_usa_sesion_de_usuario(self) -> None:
        headers = verificar_supabase_mvp.build_service_headers("sb_secret_abc123")

        self.assertEqual(headers["apikey"], "sb_secret_abc123")
        self.assertEqual(headers["Authorization"], "Bearer sb_secret_abc123")
        self.assertNotIn("Cookie", headers)
        self.assertNotIn("X-Supabase-Auth", headers)

    def test_error_42501_con_hint_anon_expone_rol_efectivo_publico(self) -> None:
        status, detail = verificar_supabase_mvp.classify_error(
            401,
            '{"code":"42501","message":"permission denied for table subscription_plans","hint":"Grant the required privileges to the current role with: GRANT SELECT ON public.subscription_plans TO anon;"}',
        )

        self.assertEqual(status, "PERMISOS")
        self.assertIn("TO anon", detail)


if __name__ == "__main__":
    unittest.main()

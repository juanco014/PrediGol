from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Any

from scripts import verificar_supabase_mvp


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


if __name__ == "__main__":
    unittest.main()

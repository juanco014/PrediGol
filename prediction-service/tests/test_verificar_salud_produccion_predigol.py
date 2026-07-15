from __future__ import annotations

import io
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import httpx

from scripts import verificar_salud_produccion_predigol as health


INDEX = """<!doctype html><html><head><title>PrediGol | Pronósticos</title><script type="module" src="/assets/index.js"></script><link rel="stylesheet" href="/assets/index.css"></head><body><div id="root"></div></body></html>"""


class FakeClient:
    def __init__(self, routes: dict[str, httpx.Response] | None = None, timeout_urls: set[str] | None = None) -> None:
        self.routes = routes or {}
        self.timeout_urls = timeout_urls or set()

    def get(self, url: str, **kwargs):
        if url in self.timeout_urls:
            raise httpx.TimeoutException("timeout")
        if url in self.routes:
            return self.routes[url]
        if url.endswith("/assets/index.js"):
            return response(200, "application/javascript", "console.info('app')")
        if url.endswith("/assets/index.css"):
            return response(200, "text/css", "body{}")
        if "/rest/v1/model_predictions" in url:
            return response(200, "application/json", "[]")
        return response(200, "text/html; charset=utf-8", INDEX, url=url)


def response(status: int, content_type: str, body: str, url: str = "https://predigol.onrender.com/") -> httpx.Response:
    request = httpx.Request("GET", url)
    return httpx.Response(status, headers={"content-type": content_type, "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff"}, text=body, request=request)


def args(**overrides):
    parser = health.build_parser()
    parsed = parser.parse_args([])
    parsed.base_url = "https://predigol.onrender.com"
    parsed.skip_supabase = True
    parsed.timeout = 1.0
    parsed.attempts = 1
    parsed.retry_delay = 0.0
    for key, value in overrides.items():
        setattr(parsed, key, value)
    return parsed


class ProductionHealthTests(unittest.TestCase):
    def test_sitio_saludable(self) -> None:
        report = health.build_report(args(), FakeClient())

        self.assertTrue(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "sitio_publico").status, "OK")

    def test_pagina_principal_con_500(self) -> None:
        client = FakeClient({"https://predigol.onrender.com": response(500, "text/html", "error")})

        report = health.build_report(args(), client)

        self.assertFalse(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "sitio_publico").status, "ERROR")

    def test_timeout(self) -> None:
        report = health.build_report(args(), FakeClient(timeout_urls={"https://predigol.onrender.com"}))

        self.assertFalse(report.ok)
        self.assertIn("timeout", next(item for item in report.checks if item.name == "sitio_publico").detail)

    def test_asset_principal_ausente(self) -> None:
        report = health.build_report(args(), FakeClient({"https://predigol.onrender.com/assets/index.js": response(404, "text/plain", "not found")}))

        self.assertFalse(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "asset_js").status, "ERROR")

    def test_ruta_spa_con_404(self) -> None:
        report = health.build_report(args(), FakeClient({"https://predigol.onrender.com/auth": response(404, "text/plain", "Not Found")}))

        self.assertFalse(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "ruta_spa_auth").status, "ERROR")

    def test_ruta_spa_con_200(self) -> None:
        report = health.build_report(args(), FakeClient())

        self.assertEqual(next(item for item in report.checks if item.name == "ruta_spa_auth").status, "OK")

    def test_supabase_con_lista_vacia(self) -> None:
        with patch.dict(os.environ, {"PREDIGOL_MONITOR_SUPABASE_URL": "https://example.supabase.co", "PREDIGOL_MONITOR_SUPABASE_ANON_KEY": "public-key"}, clear=True):
            report = health.build_report(args(skip_supabase=False), FakeClient())

        check = next(item for item in report.checks if item.name == "supabase_publico")
        self.assertEqual(check.status, "OK")
        self.assertIn("[]", check.detail)

    def test_supabase_con_error_401(self) -> None:
        client = FakeClient({"https://example.supabase.co/rest/v1/model_predictions?select=*&limit=1": response(401, "application/json", "{}")})
        with patch.dict(os.environ, {"PREDIGOL_MONITOR_SUPABASE_URL": "https://example.supabase.co", "PREDIGOL_MONITOR_SUPABASE_ANON_KEY": "public-key"}, clear=True):
            report = health.build_report(args(skip_supabase=False), client)

        self.assertFalse(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "supabase_publico").status, "ERROR")

    def test_supabase_omitido(self) -> None:
        report = health.build_report(args(skip_supabase=True), FakeClient())

        self.assertEqual(next(item for item in report.checks if item.name == "supabase_publico").status, "OMITIDO")

    def test_secreto_rechazado(self) -> None:
        with patch.dict(os.environ, {"PREDIGOL_MONITOR_SUPABASE_URL": "https://example.supabase.co", "PREDIGOL_MONITOR_SUPABASE_ANON_KEY": "sb_" + "secret_bad"}, clear=True):
            report = health.build_report(args(skip_supabase=False), FakeClient())

        self.assertFalse(report.ok)
        self.assertEqual(next(item for item in report.checks if item.name == "supabase_publico").status, "ERROR")

    def test_salida_sin_valores_sensibles(self) -> None:
        stream = io.StringIO()
        report = health.HealthReport("https://predigol.onrender.com")
        report.add("supabase", "ERROR", "token=eyJaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc&apikey=secret")

        with redirect_stdout(stream):
            health.print_report(report)

        output = stream.getvalue()
        self.assertNotIn("eyJaaaaaaaaaaa", output)
        self.assertNotIn("apikey=secret", output)

    def test_url_base_censura_parametros_sensibles(self) -> None:
        stream = io.StringIO()
        report = health.HealthReport("https://predigol.onrender.com?token=secret&apikey=public")

        with redirect_stdout(stream):
            health.print_report(report)

        output = stream.getvalue()
        self.assertNotIn("token=secret", output)
        self.assertNotIn("apikey=public", output)

    def test_codigo_global_correcto_con_cero_predicciones(self) -> None:
        with patch.dict(os.environ, {"PREDIGOL_MONITOR_SUPABASE_URL": "https://example.supabase.co", "PREDIGOL_MONITOR_SUPABASE_ANON_KEY": "public-key"}, clear=True):
            report = health.build_report(args(skip_supabase=False), FakeClient())

        self.assertTrue(report.ok)


if __name__ == "__main__":
    unittest.main()

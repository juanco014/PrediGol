from __future__ import annotations

import argparse
import os
import re
import time
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Protocol
from urllib.parse import urljoin, urlparse

import httpx

DEFAULT_BASE_URL = "https://predigol.onrender.com"
DEFAULT_TIMEOUT = 12.0
DEFAULT_ATTEMPTS = 2
DEFAULT_RETRY_DELAY = 2.0
SPA_ROUTES = ["/auth", "/inicio", "/pronosticos", "/perfil", "/admin", "/explorar", "/ranking", "/ligas"]
EXPECTED_TITLE = "PrediGol"
WINDOWS_PATH_PATTERN = re.compile(r"[A-Za-z]:\\\\(?:Users|Windows|Program Files)", re.IGNORECASE)
JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
SECRET_PREFIX = "sb_" + "secret_"
PUBLIC_KEY_ENV = ("PREDIGOL_MONITOR_SUPABASE_PUBLISHABLE_KEY", "PREDIGOL_MONITOR_SUPABASE_ANON_KEY")


class HttpClient(Protocol):
    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        ...


@dataclass
class Check:
    name: str
    status: str
    detail: str
    duration_ms: int | None = None


@dataclass
class HealthReport:
    base_url: str
    checks: list[Check] = field(default_factory=list)

    def add(self, name: str, status: str, detail: str, duration_ms: int | None = None) -> None:
        self.checks.append(Check(name, status, sanitize_detail(detail), duration_ms))

    @property
    def ok(self) -> bool:
        return not any(check.status == "ERROR" for check in self.checks)


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href"):
            self.stylesheets.append(values["href"] or "")
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self.title_parts).strip()


def sanitize_detail(value: str) -> str:
    value = JWT_PATTERN.sub("[jwt-redacted]", value)
    value = re.sub(r"(?i)(apikey|authorization|token|password|key)=([^&\s]+)", r"\1=[redacted]", value)
    value = value.replace(SECRET_PREFIX, "supabase-secret-[redacted]")
    return value[:500]


def configured(value: str | None) -> bool:
    return bool(value and value.strip())


def looks_forbidden_secret(value: str | None) -> bool:
    if not value:
        return False
    stripped = value.strip()
    return stripped.startswith(SECRET_PREFIX) or bool(JWT_PATTERN.search(stripped))


def safe_url_join(base_url: str, path: str) -> str:
    return urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))


def response_duration_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def fetch_with_retries(client: HttpClient, url: str, *, timeout: float, attempts: int, retry_delay: float) -> tuple[httpx.Response | None, str | None, int]:
    last_error: str | None = None
    started = time.perf_counter()
    for attempt in range(1, attempts + 1):
        try:
            response = client.get(url, timeout=timeout, follow_redirects=True)
            return response, None, response_duration_ms(started)
        except httpx.TimeoutException:
            last_error = f"timeout en intento {attempt}"
        except httpx.RequestError as error:
            last_error = f"error de red {error.__class__.__name__}"
        if attempt < attempts:
            time.sleep(retry_delay)
    return None, last_error or "error desconocido", response_duration_ms(started)


def is_html_response(response: httpx.Response) -> bool:
    return "text/html" in response.headers.get("content-type", "").lower()


def has_app_marker(body: str) -> bool:
    return EXPECTED_TITLE.lower() in body.lower() or '<div id="root"></div>' in body or '<div id="root">' in body


def content_has_bad_references(body: str) -> list[str]:
    findings: list[str] = []
    if "http://" in body:
        findings.append("referencias http://")
    if "localhost" in body or "127.0.0.1" in body:
        findings.append("referencias localhost")
    if WINDOWS_PATH_PATTERN.search(body):
        findings.append("rutas locales Windows")
    return findings


def reference_status(findings: list[str], *, asset: bool = False) -> str:
    if not findings:
        return "OK"
    if asset and not any("rutas locales Windows" in finding for finding in findings):
        return "ADVERTENCIA"
    return "ERROR"


def check_main_site(report: HealthReport, client: HttpClient, *, timeout: float, attempts: int, retry_delay: float) -> tuple[str | None, AssetParser | None]:
    response, error, duration = fetch_with_retries(client, report.base_url, timeout=timeout, attempts=attempts, retry_delay=retry_delay)
    if response is None:
        report.add("sitio_publico", "ERROR", error or "sin respuesta", duration)
        return None, None

    parsed_host = urlparse(str(response.url)).hostname or ""
    if parsed_host in {"localhost", "127.0.0.1"}:
        report.add("sitio_publico", "ERROR", "redireccion a localhost", duration)
        return None, None

    if response.status_code != 200:
        report.add("sitio_publico", "ERROR", f"HTTP {response.status_code}", duration)
        return response.text, None
    if not is_html_response(response):
        report.add("sitio_publico", "ERROR", f"Content-Type inesperado: {response.headers.get('content-type', 'sin content-type')}", duration)
        return response.text, None

    parser = AssetParser()
    parser.feed(response.text)
    if EXPECTED_TITLE.lower() not in parser.title.lower() and not has_app_marker(response.text):
        report.add("sitio_publico", "ERROR", "no se encontro marcador de PrediGol", duration)
    else:
        detail = f"HTTP 200 HTML; titulo={parser.title or 'N/D'}"
        if duration > 8000:
            report.add("sitio_publico", "ADVERTENCIA", f"respuesta lenta posible cold start; {detail}", duration)
        else:
            report.add("sitio_publico", "OK", detail, duration)

    findings = content_has_bad_references(response.text)
    report.add("html_referencias", reference_status(findings), ", ".join(findings) if findings else "sin referencias inseguras evidentes")
    return response.text, parser


def check_asset(report: HealthReport, client: HttpClient, base_url: str, asset_path: str, asset_type: str, *, timeout: float, attempts: int, retry_delay: float) -> None:
    url = safe_url_join(base_url, asset_path)
    response, error, duration = fetch_with_retries(client, url, timeout=timeout, attempts=attempts, retry_delay=retry_delay)
    if response is None:
        report.add(f"asset_{asset_type}", "ERROR", error or "sin respuesta", duration)
        return
    content_type = response.headers.get("content-type", "").lower()
    expected = "javascript" if asset_type == "js" else "css"
    if response.status_code != 200:
        report.add(f"asset_{asset_type}", "ERROR", f"HTTP {response.status_code}", duration)
        return
    if expected not in content_type:
        report.add(f"asset_{asset_type}", "ERROR", f"Content-Type inesperado: {content_type or 'sin content-type'}", duration)
        return
    findings = content_has_bad_references(response.text)
    detail = ", ".join(findings) if findings else f"HTTP 200; {content_type}"
    if findings and reference_status(findings, asset=True) == "ADVERTENCIA":
        detail += "; revisar si proviene de dependencias cliente"
    report.add(f"asset_{asset_type}", reference_status(findings, asset=True), detail, duration)


def check_assets(report: HealthReport, client: HttpClient, parser: AssetParser | None, *, timeout: float, attempts: int, retry_delay: float) -> None:
    if parser is None:
        report.add("assets", "OMITIDO", "index.html no disponible")
        return
    js_asset = next((item for item in parser.scripts if item.endswith(".js")), None)
    css_asset = next((item for item in parser.stylesheets if item.endswith(".css")), None)
    if not js_asset:
        report.add("asset_js", "ERROR", "no se encontro script principal")
    else:
        check_asset(report, client, report.base_url, js_asset, "js", timeout=timeout, attempts=attempts, retry_delay=retry_delay)
    if not css_asset:
        report.add("asset_css", "ERROR", "no se encontro stylesheet principal")
    else:
        check_asset(report, client, report.base_url, css_asset, "css", timeout=timeout, attempts=attempts, retry_delay=retry_delay)


def check_spa_routes(report: HealthReport, client: HttpClient, *, timeout: float, attempts: int, retry_delay: float) -> None:
    for route in SPA_ROUTES:
        response, error, duration = fetch_with_retries(client, safe_url_join(report.base_url, route), timeout=timeout, attempts=attempts, retry_delay=retry_delay)
        name = f"ruta_spa_{route.strip('/')}"
        if response is None:
            report.add(name, "ERROR", error or "sin respuesta", duration)
            continue
        if response.status_code == 404 and "Not Found" in response.text:
            report.add(name, "ERROR", "404 de Render", duration)
            continue
        if response.status_code != 200:
            report.add(name, "ERROR", f"HTTP {response.status_code}", duration)
            continue
        if not is_html_response(response):
            report.add(name, "ERROR", f"Content-Type inesperado: {response.headers.get('content-type', 'sin content-type')}", duration)
            continue
        if not has_app_marker(response.text):
            report.add(name, "ERROR", "no entrega index.html de la app", duration)
            continue
        report.add(name, "OK", "HTTP 200 HTML; React Router puede tomar control", duration)


def check_security_headers(report: HealthReport, headers: httpx.Headers | dict[str, str] | None) -> None:
    if not headers:
        report.add("headers_seguridad", "OMITIDO", "sin headers disponibles")
        return
    lower = {key.lower(): value for key, value in dict(headers).items()}
    required = {
        "strict-transport-security": "Strict-Transport-Security",
        "x-content-type-options": "X-Content-Type-Options",
        "referrer-policy": "Referrer-Policy",
        "permissions-policy": "Permissions-Policy",
        "content-security-policy": "Content-Security-Policy",
    }
    missing = [label for key, label in required.items() if key not in lower]
    has_frame_control = "x-frame-options" in lower or "frame-ancestors" in lower.get("content-security-policy", "")
    if not has_frame_control:
        missing.append("X-Frame-Options o CSP frame-ancestors")
    report.add("headers_seguridad", "ADVERTENCIA" if missing else "OK", "faltan: " + ", ".join(missing) if missing else "headers principales presentes")


def public_supabase_env() -> tuple[str | None, str | None, str | None]:
    url = os.environ.get("PREDIGOL_MONITOR_SUPABASE_URL", "").strip()
    key = next((os.environ.get(name, "").strip() for name in PUBLIC_KEY_ENV if os.environ.get(name, "").strip()), "")
    forbidden = next((name for name in ("SUPABASE_SERVICE_ROLE_KEY", "FOOTBALL_API_KEY", "API_FOOTBALL_KEY") if configured(os.environ.get(name))), None)
    return url or None, key or None, forbidden


def check_supabase(report: HealthReport, client: HttpClient, *, timeout: float, skip: bool) -> None:
    if skip:
        report.add("supabase_publico", "OMITIDO", "omitido por --skip-supabase")
        return
    url, key, forbidden = public_supabase_env()
    if forbidden:
        report.add("supabase_publico", "ERROR", f"variable prohibida presente para monitoreo: {forbidden}")
        return
    if not url or not key:
        report.add("supabase_publico", "CONFIGURACION PENDIENTE", "faltan PREDIGOL_MONITOR_SUPABASE_URL y clave publica de monitoreo")
        return
    if looks_forbidden_secret(key):
        report.add("supabase_publico", "ERROR", "la clave configurada parece secreta o JWT privado")
        return
    endpoint = url.rstrip("/") + "/rest/v1/model_predictions?select=*&limit=1"
    started = time.perf_counter()
    try:
        response = client.get(endpoint, timeout=timeout, headers={"apikey": key, "authorization": f"Bearer {key}", "accept": "application/json"})
    except httpx.TimeoutException:
        report.add("supabase_publico", "ERROR", "timeout", response_duration_ms(started))
        return
    except httpx.RequestError as error:
        report.add("supabase_publico", "ERROR", f"error de red {error.__class__.__name__}", response_duration_ms(started))
        return
    if response.status_code in {401, 403}:
        report.add("supabase_publico", "ERROR", f"error de permisos HTTP {response.status_code}", response_duration_ms(started))
        return
    if response.status_code >= 500:
        report.add("supabase_publico", "ERROR", f"Supabase HTTP {response.status_code}", response_duration_ms(started))
        return
    if response.status_code != 200:
        report.add("supabase_publico", "ADVERTENCIA", f"HTTP {response.status_code}; revisar permisos/RLS", response_duration_ms(started))
        return
    try:
        payload = response.json()
    except ValueError:
        report.add("supabase_publico", "ERROR", "respuesta no JSON", response_duration_ms(started))
        return
    if isinstance(payload, list) and len(payload) == 0:
        report.add("supabase_publico", "OK", "lectura publica respondio []; cero predicciones es valido", response_duration_ms(started))
    elif isinstance(payload, list):
        report.add("supabase_publico", "OK", f"lectura publica respondio {len(payload)} fila(s)", response_duration_ms(started))
    else:
        report.add("supabase_publico", "ADVERTENCIA", "respuesta JSON inesperada", response_duration_ms(started))


def build_report(args: argparse.Namespace, client: HttpClient | None = None) -> HealthReport:
    client = client or httpx.Client()
    report = HealthReport(base_url=args.base_url.rstrip("/"))
    main_body, parser = check_main_site(report, client, timeout=args.timeout, attempts=args.attempts, retry_delay=args.retry_delay)
    headers: httpx.Headers | dict[str, str] | None = None
    if main_body is not None:
        response, _, _ = fetch_with_retries(client, report.base_url, timeout=args.timeout, attempts=1, retry_delay=0)
        headers = response.headers if response is not None else None
    check_assets(report, client, parser, timeout=args.timeout, attempts=args.attempts, retry_delay=args.retry_delay)
    check_spa_routes(report, client, timeout=args.timeout, attempts=args.attempts, retry_delay=args.retry_delay)
    check_security_headers(report, headers)
    check_supabase(report, client, timeout=args.timeout, skip=args.skip_supabase)
    return report


def print_report(report: HealthReport) -> None:
    print(f"PrediGol - salud produccion: {sanitize_detail(report.base_url)}")
    for check in report.checks:
        suffix = f" ({check.duration_ms} ms)" if check.duration_ms is not None else ""
        print(f"- {check.name}: {check.status} - {check.detail}{suffix}")
    print(f"Resumen: {'OK' if report.ok else 'ERROR'}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verifica salud publica de PrediGol en produccion sin escrituras.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--skip-supabase", action="store_true", help="Omite lectura publica Supabase.")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    parser.add_argument("--attempts", type=int, default=DEFAULT_ATTEMPTS)
    parser.add_argument("--retry-delay", type=float, default=DEFAULT_RETRY_DELAY)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.attempts = max(1, min(args.attempts, 3))
    args.timeout = max(1.0, args.timeout)
    args.retry_delay = max(0.0, args.retry_delay)
    report = build_report(args)
    print_report(report)
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

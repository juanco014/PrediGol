from __future__ import annotations

import json
import os
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import httpx

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_env_file, load_settings  # noqa: E402
from predigol_model.supabase_client import SupabaseRestClient  # noqa: E402


REQUIRED_FRONTEND_VARS = ["VITE_SUPABASE_URL"]
FRONTEND_KEY_ALTERNATIVES = ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"]
REQUIRED_BACKEND_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
OPTIONAL_BLOCKED_VARS = ["FOOTBALL_API_KEY", "API_FOOTBALL_KEY"]
CORE_TABLES = ["profiles", "model_predictions", "model_runs", "model_datasets", "team_aliases", "subscription_plans", "user_subscriptions"]
CORE_RPCS = ["predigol_es_admin", "obtener_plan_usuario", "obtener_predicciones_visibles", "predigol_usuario_tiene_premium"]
SUPABASE_SECRET_PREFIX = "sb_" + "secret_"
SECRET_PATTERNS = [
    ("supabase_secret_key", re.compile(rf"{SUPABASE_SECRET_PREFIX}[A-Za-z0-9_\-.]{{12,}}")),
    ("jwt_like_token", re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")),
    ("api_football_key_assignment", re.compile(r"(?i)(FOOTBALL_API_KEY|API_FOOTBALL_KEY)\s*=\s*[^\s#<][^\s#]{8,}")),
    ("test_password_assignment", re.compile(r"(?i)PREDIGOL_TEST_.*PASSWORD\s*=\s*[^\s#<][^\s#]{4,}")),
]


class ReadClient(Protocol):
    def count(self, table: str, params: dict[str, str] | None = None) -> int | None:
        ...

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        ...

    def rpc(self, function_name: str, payload: dict[str, Any] | None = None) -> Any:
        ...


@dataclass
class Check:
    name: str
    status: str
    detail: str


@dataclass
class DeploymentReport:
    checks: list[Check] = field(default_factory=list)
    frontend_ready: bool = False
    authenticated_ready: bool = False
    live_predictions_ready: bool = False
    pending_actions: list[str] = field(default_factory=list)
    secret_findings: list[dict[str, str]] = field(default_factory=list)

    def add(self, name: str, status: str, detail: str) -> None:
        self.checks.append(Check(name, status, detail))


def configured(value: str | None) -> bool:
    return bool(value and value.strip())


def safe_bool(value: bool) -> str:
    return "configurada" if value else "faltante"


def load_known_env(root: Path) -> None:
    load_env_file(root / ".env")
    load_env_file(root / "prediction-service" / ".env")
    load_env_file(root / "predigol-web" / ".env")
    load_env_file(root / "predigol-web" / ".env.local")


def check_files(root: Path, report: DeploymentReport) -> None:
    required = [
        "predigol-web/package.json",
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
    missing = [item for item in required if not (root / item).exists()]
    report.add("archivos_requeridos", "OK" if not missing else "BLOQUEADO", "todos presentes" if not missing else f"faltan: {', '.join(missing)}")


def check_python(report: DeploymentReport) -> None:
    version = sys.version_info
    report.add("python_version", "OK" if version >= (3, 11) else "BLOQUEADO", platform.python_version())
    in_venv = bool(getattr(sys, "real_prefix", None) or sys.prefix != getattr(sys, "base_prefix", sys.prefix))
    report.add("python_venv", "OK" if in_venv else "ADVERTENCIA", "ejecutando dentro de venv" if in_venv else "no se detecto venv activo")
    try:
        import httpx as _httpx  # noqa: F401

        report.add("python_dependencias", "OK", "httpx disponible")
    except Exception as error:  # noqa: BLE001
        report.add("python_dependencias", "BLOQUEADO", f"dependencia faltante: {error.__class__.__name__}")


def check_node(root: Path, report: DeploymentReport) -> None:
    node = shutil.which("node")
    npm = shutil.which("npm")
    report.add("node", "OK" if node else "BLOQUEADO", "node disponible" if node else "node no encontrado")
    report.add("npm", "OK" if npm else "BLOQUEADO", "npm disponible" if npm else "npm no encontrado")
    package = root / "predigol-web" / "package.json"
    report.add("frontend_package", "OK" if package.exists() else "BLOQUEADO", "predigol-web/package.json presente" if package.exists() else "package.json ausente")


def public_key_configured() -> bool:
    return any(configured(os.environ.get(key)) for key in FRONTEND_KEY_ALTERNATIVES)


def value_looks_secret(value: str | None) -> bool:
    if not value:
        return False
    stripped = value.strip()
    return stripped.startswith(SUPABASE_SECRET_PREFIX) or bool(SECRET_PATTERNS[1][1].search(stripped))


def check_env(report: DeploymentReport) -> None:
    for key in REQUIRED_FRONTEND_VARS:
        report.add(f"env_{key}", "OK" if configured(os.environ.get(key)) else "PENDIENTE CONFIGURACION", safe_bool(configured(os.environ.get(key))))
    report.add("env_frontend_key", "OK" if public_key_configured() else "PENDIENTE CONFIGURACION", "publishable/anon configurada" if public_key_configured() else "falta VITE_SUPABASE_PUBLISHABLE_KEY o VITE_SUPABASE_ANON_KEY")
    for key in REQUIRED_BACKEND_VARS:
        report.add(f"env_{key}", "OK" if configured(os.environ.get(key)) else "PENDIENTE CONFIGURACION", safe_bool(configured(os.environ.get(key))))
    for key in OPTIONAL_BLOCKED_VARS:
        report.add(f"env_{key}", "ADVERTENCIA" if configured(os.environ.get(key)) else "OK", "presente; no se consulta API-Football en este preflight" if configured(os.environ.get(key)) else "no configurada")

    exposed = [key for key, value in os.environ.items() if key.startswith("VITE_") and value_looks_secret(value)]
    report.add("vite_secret_scan_env", "BLOQUEADO" if exposed else "OK", "variables VITE con formato secreto detectadas" if exposed else "sin secretos obvios en VITE_*")


def git_files(root: Path) -> list[Path]:
    try:
        result = subprocess.run(["git", "ls-files"], cwd=root, check=True, capture_output=True, text=True, timeout=30)
    except Exception:  # noqa: BLE001
        return []
    return [root / line.strip() for line in result.stdout.splitlines() if line.strip()]


def scan_tracked_secrets(root: Path) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for path in git_files(root):
        if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = str(path.relative_to(root)).replace("\\", "/")
        for line in text.splitlines():
            normalized = line.strip().casefold()
            if not normalized or normalized.startswith("#"):
                continue
            if normalized.startswith(("def ", "class ")):
                continue
            if any(marker in normalized for marker in ["tu_", "placeholder", "fake", "example", "ejemplo", "abc123", "<", "os.environ", "deno.env", "getenv"]):
                continue
            for finding_type, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    findings.append({"file": rel, "type": finding_type})
                    break
    return findings


def check_secret_files(root: Path, report: DeploymentReport) -> None:
    findings = scan_tracked_secrets(root)
    report.secret_findings = findings
    report.add("secretos_versionados", "BLOQUEADO" if findings else "OK", f"{len(findings)} posible(s) exposicion(es)" if findings else "sin secretos reales evidentes en archivos versionados")


def check_supabase(report: DeploymentReport, client: ReadClient | None = None) -> None:
    if client is None:
        try:
            settings = load_settings()
            client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        except Exception as error:  # noqa: BLE001
            report.add("supabase_conexion", "PENDIENTE CONFIGURACION", f"no se creo cliente: {error.__class__.__name__}")
            return
    try:
        profiles = client.count("profiles")
        report.add("supabase_conexion", "OK", f"REST accesible; profiles={profiles if profiles is not None else 'desconocido'}")
    except Exception as error:  # noqa: BLE001
        report.add("supabase_conexion", "ADVERTENCIA", f"Supabase no disponible: {error.__class__.__name__}")
        return

    for table in CORE_TABLES:
        try:
            client.select(table, {"select": "*", "limit": "1"})
            report.add(f"tabla_{table}", "OK", "accesible")
        except Exception as error:  # noqa: BLE001
            report.add(f"tabla_{table}", "ADVERTENCIA", f"no accesible: {error.__class__.__name__}")

    for rpc in CORE_RPCS:
        try:
            payload = {"p_limit": 1} if rpc == "obtener_predicciones_visibles" else {}
            client.rpc(rpc, payload)
            report.add(f"rpc_{rpc}", "OK", "ejecutable")
        except Exception as error:  # noqa: BLE001
            report.add(f"rpc_{rpc}", "ADVERTENCIA", f"no ejecutable: {error.__class__.__name__}")

    try:
        future_fixtures = client.count("football_fixtures", {"kickoff_at": "gt.now()"}) or 0
        upcoming_predictions = client.count("model_predictions") or 0
        upcoming_partidos = client.count("partidos", {"estado": "eq.proximo", "api_football_fixture_id": "not.is.null"}) or 0
        report.add("fixtures_futuros", "ADVERTENCIA" if future_fixtures == 0 else "OK", f"football_fixtures futuros={future_fixtures}; partidos proximos con fixture={upcoming_partidos}")
        report.add("predicciones_modelo", "ADVERTENCIA" if upcoming_predictions == 0 else "OK", f"model_predictions={upcoming_predictions}; cero datos no bloquea frontend")
    except Exception as error:  # noqa: BLE001
        report.add("fuente_fixtures", "ADVERTENCIA", f"no se pudo contar fixtures/predicciones: {error.__class__.__name__}")


def check_fixture_source(report: DeploymentReport) -> None:
    report.add("api_football_preflight", "BLOQUEADO", "no se consulta API-Football en despliegue; fases 7J documentaron plan sin acceso a temporada actual")
    report.add("sincronizaciones", "BLOQUEADO", "crons/importaciones/publicaciones reales quedan bloqueados hasta fuente valida; no usar --apply")


def summarize(report: DeploymentReport) -> None:
    frontend_blockers = {"archivos_requeridos", "node", "npm", "frontend_package", "vite_secret_scan_env", "secretos_versionados"}
    frontend_status = [check for check in report.checks if check.name in frontend_blockers]
    env_frontend_ok = configured(os.environ.get("VITE_SUPABASE_URL")) and public_key_configured()
    report.frontend_ready = all(check.status != "BLOQUEADO" for check in frontend_status) and env_frontend_ok
    report.authenticated_ready = any(check.name == "supabase_conexion" and check.status == "OK" for check in report.checks) and all(
        check.status != "BLOQUEADO" for check in report.checks if check.name.startswith("rpc_") or check.name.startswith("tabla_")
    )
    report.live_predictions_ready = any(check.name == "fixtures_futuros" and check.status == "OK" for check in report.checks) and any(
        check.name == "predicciones_modelo" and check.status == "OK" for check in report.checks
    )
    if not env_frontend_ok:
        report.pending_actions.append("Configurar variables publicas VITE_SUPABASE_URL y publishable/anon key en el proveedor frontend.")
    if not report.live_predictions_ready:
        report.pending_actions.append("Mantener bloqueadas predicciones en vivo hasta contar con fixtures actuales reales y fuente habilitada.")
    if any(check.status == "BLOQUEADO" for check in report.checks if check.name in {"vite_secret_scan_env", "secretos_versionados"}):
        report.pending_actions.append("Resolver posible exposicion de secretos antes de despliegue.")


def build_report(root: Path = ROOT, client: ReadClient | None = None) -> DeploymentReport:
    load_known_env(root)
    report = DeploymentReport()
    check_files(root, report)
    check_python(report)
    check_node(root, report)
    check_env(report)
    check_secret_files(root, report)
    check_supabase(report, client=client)
    check_fixture_source(report)
    summarize(report)
    return report


def report_to_dict(report: DeploymentReport) -> dict[str, Any]:
    return {
        "ok": report.frontend_ready and report.authenticated_ready and not report.secret_findings,
        "frontend_ready": report.frontend_ready,
        "authenticated_operation_ready": report.authenticated_ready,
        "live_predictions_ready": report.live_predictions_ready,
        "checks": [check.__dict__ for check in report.checks],
        "secret_findings": report.secret_findings,
        "pending_actions": report.pending_actions,
        "notes": [
            "Este preflight no consulta API-Football.",
            "Este preflight no escribe en Supabase.",
            "La falta de fixtures actuales no bloquea el despliegue frontend.",
        ],
    }


def main() -> int:
    report = build_report()
    print(json.dumps(report_to_dict(report), ensure_ascii=False, indent=2))
    return 0 if not report.secret_findings and report.frontend_ready else 1


if __name__ == "__main__":
    raise SystemExit(main())

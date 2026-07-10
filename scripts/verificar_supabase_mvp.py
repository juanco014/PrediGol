from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_env_file  # noqa: E402


EXPECTED_TABLES = [
    "profiles",
    "model_predictions",
    "model_runs",
    "model_datasets",
    "team_aliases",
    "subscription_plans",
    "user_subscriptions",
]

EXPECTED_RPCS: list[tuple[str, dict[str, Any]]] = [
    ("predigol_es_admin", {}),
    ("obtener_plan_usuario", {}),
    ("obtener_predicciones_visibles", {"p_limit": 24}),
    ("predigol_usuario_tiene_premium", {}),
]

SENSITIVE_TABLES = [
    "model_predictions",
    "model_runs",
    "model_datasets",
    "team_aliases",
    "subscription_plans",
    "user_subscriptions",
]


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str


def configured(value: str | None) -> bool:
    return bool(value and value.strip())


def classify_error(status_code: int, body: str) -> tuple[str, str]:
    lowered = body.lower()
    if status_code == 400 and "p0001" in lowered and "debes iniciar sesi" in lowered:
        return "PENDIENTE SESION", "RPC existente y protegida; requiere usuario autenticado para validacion funcional"
    if "permission denied" in lowered or status_code in {401, 403}:
        return "PERMISOS", "credenciales sin permiso o grant/RLS insuficiente"
    if status_code == 404 or "pgrst202" in lowered or "could not find" in lowered:
        return "FALTANTE", "no existe o no esta en cache REST"
    if "pgrst203" in lowered or "could not choose the best candidate function" in lowered:
        return "ERROR", "firma incorrecta o ambigua"
    return "ERROR", f"HTTP {status_code}"


def get_sample_fixture_id(client: httpx.Client) -> int | None:
    try:
        response = client.get(
            "/model_predictions",
            params={
                "select": "api_football_fixture_id",
                "api_football_fixture_id": "not.is.null",
                "order": "generated_at.desc",
                "limit": "1",
            },
        )
    except httpx.HTTPError:
        return None

    if response.status_code not in {200, 206}:
        return None

    try:
        rows = response.json()
    except ValueError:
        return None

    if not rows:
        return None

    fixture_id = rows[0].get("api_football_fixture_id")
    try:
        return int(fixture_id) if fixture_id is not None else None
    except (TypeError, ValueError):
        return None


def get_client() -> httpx.Client | None:
    env_file = SERVICE / ".env"
    load_env_file(env_file)
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    print("PrediGol - verificacion Supabase MVP")
    print(f"prediction-service/.env: {'OK' if env_file.exists() else 'FALTANTE'}")
    print(f"SUPABASE_URL: {'OK' if configured(supabase_url) else 'FALTANTE'}")
    print(f"SUPABASE_SERVICE_ROLE_KEY: {'OK' if configured(service_key) else 'FALTANTE'}")

    if not configured(supabase_url) or not configured(service_key):
        print("Supabase: sin credenciales completas. No se muestran secretos.")
        return None

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    return httpx.Client(base_url=f"{supabase_url}/rest/v1", headers=headers, timeout=30)


def check_table(client: httpx.Client, table: str) -> CheckResult:
    try:
        response = client.get(f"/{table}", params={"select": "*", "limit": "1"})
    except httpx.HTTPError as error:
        return CheckResult(table, "ERROR", f"conexion: {error.__class__.__name__}")

    if response.status_code in {200, 206}:
        return CheckResult(table, "OK", "accesible")

    status, detail = classify_error(response.status_code, response.text)
    return CheckResult(table, status, detail)


def check_rpc(client: httpx.Client, name: str, payload: dict[str, Any], *, null_is_pending: bool = False) -> CheckResult:
    try:
        response = client.post(f"/rpc/{name}", content=json.dumps(payload))
    except httpx.HTTPError as error:
        return CheckResult(name, "ERROR", f"conexion: {error.__class__.__name__}")

    if response.status_code in {200, 204}:
        if null_is_pending and response.text.strip().lower() in {"", "null"}:
            return CheckResult(name, "PENDIENTE DATOS", "RPC ejecutable; falta fixture existente para validacion funcional")
        return CheckResult(name, "OK", "ejecutable")

    status, detail = classify_error(response.status_code, response.text)
    return CheckResult(name, status, detail)


def print_results(title: str, results: list[CheckResult]) -> None:
    print(title)
    for result in results:
        print(f"- {result.name}: {result.status} ({result.detail})")


def main() -> int:
    client = get_client()
    if client is None:
        return 1

    with client:
        table_results = [check_table(client, table) for table in EXPECTED_TABLES]
        fixture_id = get_sample_fixture_id(client)
        rpc_results = [check_rpc(client, name, payload) for name, payload in EXPECTED_RPCS]
        rpc_results.append(
            check_rpc(
                client,
                "obtener_prediccion_visible",
                {"p_api_football_fixture_id": fixture_id or 0},
                null_is_pending=fixture_id is None,
            )
        )

    print_results("Tablas", table_results)
    print_results("RPC", rpc_results)

    accepted_statuses = {"OK", "PENDIENTE SESION", "PENDIENTE DATOS"}
    missing = [result for result in [*table_results, *rpc_results] if result.status not in accepted_statuses]
    if missing:
        print("Resumen: FALTAN elementos MVP o no son accesibles.")
        print("Accion: aplica/verifica migraciones pendientes sin hacer reset de la base real.")
        return 1

    print("Resumen: Supabase MVP OK.")
    print("RLS: tablas sensibles accesibles con service role; valida usuarios anon/auth en navegador para confirmar policies.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

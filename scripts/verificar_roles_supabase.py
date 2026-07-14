from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import httpx

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"
WEB = ROOT / "predigol-web"
sys.path.insert(0, str(SERVICE))

from predigol_model.config import load_env_file  # noqa: E402


ROLE_CONFIG = {
    "gratis": {
        "email": "PREDIGOL_TEST_FREE_EMAIL",
        "password": "PREDIGOL_TEST_FREE_PASSWORD",
        "expect_premium": False,
        "expect_admin": False,
    },
    "premium": {
        "email": "PREDIGOL_TEST_PREMIUM_EMAIL",
        "password": "PREDIGOL_TEST_PREMIUM_PASSWORD",
        "expect_premium": True,
        "expect_admin": False,
    },
    "admin": {
        "email": "PREDIGOL_TEST_ADMIN_EMAIL",
        "password": "PREDIGOL_TEST_ADMIN_PASSWORD",
        "expect_premium": None,
        "expect_admin": True,
    },
}

ADMIN_TABLES = ["model_runs", "model_datasets", "team_aliases"]
SENSITIVE_WORDS = ("password", "contrasena", "access_token", "refresh_token", "apikey", "authorization", "bearer")


@dataclass
class CheckResult:
    scope: str
    name: str
    status: str
    detail: str


@dataclass
class AuthSession:
    role_name: str
    email_label: str
    user_id: str
    access_token: str


def configured(value: str | None) -> bool:
    return bool(value and value.strip())


def redact(value: str) -> str:
    redacted = value
    for key in SENSITIVE_WORDS:
        redacted = redacted.replace(key, "[redactado]")
        redacted = redacted.replace(key.upper(), "[redactado]")
    return redacted


def normalize_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
    return None


def parse_json_response(response: httpx.Response) -> Any:
    if not response.text.strip():
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def is_active_subscription(row: dict[str, Any] | None) -> bool:
    if not row:
        return False
    if row.get("plan_code") != "premium":
        return False
    if row.get("status") not in {"premium_active", "trial"}:
        return False
    expires_at = row.get("expires_at")
    if not expires_at:
        return True
    try:
        parsed = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed > datetime.now(timezone.utc)


def make_rest_client(supabase_url: str, anon_key: str, access_token: str) -> httpx.Client:
    return httpx.Client(
        base_url=f"{supabase_url.rstrip('/')}/rest/v1",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )


def sign_in(
    supabase_url: str,
    anon_key: str,
    role_name: str,
    email: str,
    password: str,
    *,
    client_factory: Callable[..., httpx.Client] = httpx.Client,
) -> tuple[AuthSession | None, CheckResult]:
    headers = {"apikey": anon_key, "Content-Type": "application/json"}
    payload = {"email": email, "password": password}
    try:
        with client_factory(base_url=f"{supabase_url.rstrip('/')}/auth/v1", headers=headers, timeout=30) as client:
            response = client.post("/token?grant_type=password", content=json.dumps(payload))
    except httpx.HTTPError as error:
        return None, CheckResult(role_name, "inicio_sesion", "ERROR", f"conexion Auth: {error.__class__.__name__}")

    if response.status_code != 200:
        detail = "credenciales rechazadas por Supabase Auth"
        if response.status_code >= 500:
            detail = f"Auth HTTP {response.status_code}"
        return None, CheckResult(role_name, "inicio_sesion", "FALLO", detail)

    data = parse_json_response(response) or {}
    token = data.get("access_token")
    user_id = data.get("user", {}).get("id")
    if not token or not user_id:
        return None, CheckResult(role_name, "inicio_sesion", "FALLO", "Auth no devolvio usuario o token")

    return (
        AuthSession(role_name=role_name, email_label=ROLE_CONFIG[role_name]["email"], user_id=user_id, access_token=token),
        CheckResult(role_name, "inicio_sesion", "OK", "sesion real creada con Supabase Auth"),
    )


def rpc(client: httpx.Client, name: str, payload: dict[str, Any] | None = None) -> tuple[Any, str | None]:
    try:
        response = client.post(f"/rpc/{name}", content=json.dumps(payload or {}))
    except httpx.HTTPError as error:
        return None, f"conexion: {error.__class__.__name__}"
    data = parse_json_response(response)
    if response.status_code in {200, 204}:
        return data, None
    message = data.get("message") if isinstance(data, dict) else response.text
    return None, f"HTTP {response.status_code}: {redact(str(message))}"


def select_rows(client: httpx.Client, table: str, params: dict[str, str]) -> tuple[list[dict[str, Any]], str | None]:
    try:
        response = client.get(f"/{table}", params=params)
    except httpx.HTTPError as error:
        return [], f"conexion: {error.__class__.__name__}"
    data = parse_json_response(response)
    if response.status_code in {200, 206}:
        return data or [], None
    message = data.get("message") if isinstance(data, dict) else response.text
    return [], f"HTTP {response.status_code}: {redact(str(message))}"


def check_blocked_write(client: httpx.Client, scope: str, table: str) -> CheckResult:
    body_by_table = {
        "model_runs": {"model_version": "fase-7e-qa", "run_type": "dry_run", "status": "pending"},
        "model_datasets": {"name": "fase-7e-qa", "source_type": "manual", "status": "draft"},
        "team_aliases": {"canonical_name": "fase-7e", "canonical_key": "fase-7e", "alias": "fase-7e", "alias_key": "fase-7e"},
    }
    try:
        response = client.post(
            f"/{table}",
            content=json.dumps(body_by_table[table]),
            headers={"Prefer": "return=minimal,tx=rollback"},
        )
    except httpx.HTTPError as error:
        return CheckResult(scope, f"bloqueo_escritura_{table}", "ERROR", f"conexion: {error.__class__.__name__}")

    if response.status_code in {200, 201, 204}:
        return CheckResult(scope, f"bloqueo_escritura_{table}", "FALLO", "la escritura fue aceptada; revisar grants/RLS")
    return CheckResult(scope, f"bloqueo_escritura_{table}", "OK", "insert denegado para usuario autenticado")


def find_premium_prediction(predictions: list[dict[str, Any]]) -> dict[str, Any] | None:
    for prediction in predictions:
        if prediction.get("access_tier") == "premium":
            return prediction
    return None


def check_profile(client: httpx.Client, session: AuthSession) -> tuple[dict[str, Any] | None, CheckResult]:
    rows, error = select_rows(
        client,
        "profiles",
        {"select": "id,nombre,username,es_admin,rol", "id": f"eq.{session.user_id}", "limit": "1"},
    )
    if error:
        return None, CheckResult(session.role_name, "perfil", "FALLO", error)
    if not rows:
        return None, CheckResult(session.role_name, "perfil", "FALLO", "no existe fila en profiles para auth.uid()")
    return rows[0], CheckResult(session.role_name, "perfil", "OK", "profile visible para el usuario autenticado")


def check_role(session: AuthSession, client: httpx.Client, expected: dict[str, Any]) -> list[CheckResult]:
    results: list[CheckResult] = []
    results.append(CheckResult(session.role_name, "auth_uid", "OK", "usuario autenticado con auth.uid() disponible"))

    profile, profile_result = check_profile(client, session)
    results.append(profile_result)

    admin_rpc, admin_error = rpc(client, "predigol_es_admin")
    admin_value = normalize_bool(admin_rpc)
    if admin_error:
        results.append(CheckResult(session.role_name, "predigol_es_admin", "FALLO", admin_error))
    elif admin_value is expected["expect_admin"]:
        results.append(CheckResult(session.role_name, "predigol_es_admin", "OK", f"devuelve {admin_value}"))
    else:
        results.append(CheckResult(session.role_name, "predigol_es_admin", "FALLO", f"devuelve {admin_value}; esperado {expected['expect_admin']}"))

    if session.role_name == "admin" and profile:
        is_admin_profile = profile.get("rol") == "admin" or bool(profile.get("es_admin"))
        results.append(
            CheckResult(
                session.role_name,
                "rol_admin_profile",
                "OK" if is_admin_profile else "FALLO",
                "rol=admin o es_admin=true" if is_admin_profile else f"rol={profile.get('rol')} es_admin={profile.get('es_admin')}",
            )
        )

    plan, plan_error = rpc(client, "obtener_plan_usuario")
    if plan_error:
        results.append(CheckResult(session.role_name, "obtener_plan_usuario", "FALLO", plan_error))
    else:
        plan_code = plan.get("plan_code") if isinstance(plan, dict) else None
        is_premium = bool(plan.get("is_premium")) if isinstance(plan, dict) else False
        expected_premium = expected["expect_premium"]
        ok = expected_premium is None or is_premium is expected_premium
        results.append(
            CheckResult(
                session.role_name,
                "obtener_plan_usuario",
                "OK" if ok else "FALLO",
                f"plan_code={plan_code or 'desconocido'} is_premium={is_premium}",
            )
        )

    premium_rpc, premium_error = rpc(client, "predigol_usuario_tiene_premium")
    premium_value = normalize_bool(premium_rpc)
    if premium_error:
        results.append(CheckResult(session.role_name, "predigol_usuario_tiene_premium", "FALLO", premium_error))
    else:
        expected_premium = expected["expect_premium"]
        ok = expected_premium is None or premium_value is expected_premium
        results.append(
            CheckResult(
                session.role_name,
                "predigol_usuario_tiene_premium",
                "OK" if ok else "FALLO",
                f"devuelve {premium_value}" + (" (admin puede ser premium segun RPC)" if expected_premium is None else ""),
            )
        )

    if session.role_name == "premium":
        rows, error = select_rows(
            client,
            "user_subscriptions",
            {
                "select": "id,user_id,plan_code,status,started_at,expires_at",
                "user_id": f"eq.{session.user_id}",
                "order": "started_at.desc",
                "limit": "5",
            },
        )
        active = any(is_active_subscription(row) for row in rows)
        results.append(
            CheckResult(
                session.role_name,
                "suscripcion_activa",
                "OK" if active else "FALLO",
                "premium_active/trial vigente" if active else (error or "no hay suscripcion premium vigente"),
            )
        )

    predictions, predictions_error = rpc(client, "obtener_predicciones_visibles", {"p_limit": 100})
    if predictions_error:
        results.append(CheckResult(session.role_name, "obtener_predicciones_visibles", "FALLO", predictions_error))
        predictions = []
    elif isinstance(predictions, list):
        results.append(CheckResult(session.role_name, "obtener_predicciones_visibles", "OK", f"{len(predictions)} filas visibles"))
    else:
        results.append(CheckResult(session.role_name, "obtener_predicciones_visibles", "FALLO", "respuesta no es lista/setof jsonb"))
        predictions = []

    premium_prediction = find_premium_prediction(predictions)
    if not premium_prediction:
        results.append(CheckResult(session.role_name, "prediccion_premium", "PENDIENTE DATOS", "no hay una prediccion premium disponible para validar el bloqueo"))
    else:
        locked = bool(premium_prediction.get("is_locked"))
        fixture_id = premium_prediction.get("api_football_fixture_id")
        if session.role_name == "gratis":
            sensitive_hidden = all(
                premium_prediction.get(key) is None
                for key in ("home_win_probability", "draw_probability", "away_win_probability", "predicted_home_goals", "predicted_away_goals", "confidence")
            )
            results.append(
                CheckResult(
                    session.role_name,
                    "bloqueo_premium_listado",
                    "OK" if locked and sensitive_hidden else "FALLO",
                    f"is_locked={locked}; contenido_sensible_oculto={sensitive_hidden}",
                )
            )
        elif session.role_name == "premium":
            results.append(
                CheckResult(
                    session.role_name,
                    "acceso_premium_listado",
                    "OK" if not locked else "FALLO",
                    f"is_locked={locked}",
                )
            )

        if fixture_id:
            detail, detail_error = rpc(client, "obtener_prediccion_visible", {"p_api_football_fixture_id": fixture_id})
            if detail_error:
                results.append(CheckResult(session.role_name, "obtener_prediccion_visible", "FALLO", detail_error))
            elif session.role_name == "gratis":
                detail_locked = bool(detail.get("is_locked")) if isinstance(detail, dict) else False
                results.append(
                    CheckResult(
                        session.role_name,
                        "detalle_premium_bloqueado",
                        "OK" if detail_locked else "FALLO",
                        f"is_locked={detail_locked}",
                    )
                )
            elif session.role_name == "premium":
                detail_locked = bool(detail.get("is_locked")) if isinstance(detail, dict) else True
                results.append(
                    CheckResult(
                        session.role_name,
                        "detalle_premium_permitido",
                        "OK" if not detail_locked else "FALLO",
                        f"is_locked={detail_locked}",
                    )
                )

    for table in ADMIN_TABLES:
        results.append(check_blocked_write(client, session.role_name, table))

    if session.role_name in {"gratis", "premium"}:
        rows, error = select_rows(client, "model_runs", {"select": "id", "limit": "1"})
        if error:
            detail = f"consulta denegada: {error}"
        elif len(rows) == 0:
            detail = "consulta permitida, pero devolvio cero filas; no se obtuvo informacion administrativa"
        else:
            detail = f"consulta permitida y devolvio {len(rows)} fila(s) de model_runs"
        results.append(
            CheckResult(
                session.role_name,
                "lectura_admin_model_runs",
                "OK" if error or len(rows) == 0 else "FALLO",
                detail,
            )
        )
    elif session.role_name == "admin":
        _, error = select_rows(client, "model_runs", {"select": "id", "limit": "1"})
        results.append(
            CheckResult(
                session.role_name,
                "lectura_admin_model_runs",
                "OK" if not error else "FALLO",
                "consulta administrativa permitida por RLS" if not error else error,
            )
        )

    return results


def missing_credentials(role_name: str, env: dict[str, str]) -> list[CheckResult]:
    config = ROLE_CONFIG[role_name]
    missing = [name for name in (config["email"], config["password"]) if not configured(env.get(name))]
    return [
        CheckResult(
            role_name,
            "credenciales",
            "PENDIENTE CREDENCIALES",
            f"falta {name}; no se muestra ningun secreto",
        )
        for name in missing
    ]


def print_results(results: list[CheckResult]) -> None:
    current_scope = None
    for result in results:
        if result.scope != current_scope:
            current_scope = result.scope
            print(f"\n{current_scope.upper()}")
        print(f"- {result.name}: {result.status} ({result.detail})")


def run(env: dict[str, str] | None = None, *, auth_client_factory: Callable[..., httpx.Client] = httpx.Client, rest_client_factory: Callable[[str, str, str], httpx.Client] = make_rest_client) -> list[CheckResult]:
    env = env or os.environ
    results: list[CheckResult] = []
    supabase_url = (env.get("SUPABASE_URL") or "").rstrip("/")
    anon_key = (
        env.get("SUPABASE_ANON_KEY")
        or env.get("SUPABASE_PUBLISHABLE_KEY")
        or env.get("VITE_SUPABASE_ANON_KEY")
        or env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or ""
    )

    if not configured(supabase_url):
        results.append(CheckResult("config", "SUPABASE_URL", "FALLO", "variable requerida ausente"))
    if not configured(anon_key):
        results.append(CheckResult("config", "SUPABASE_ANON_KEY", "FALLO", "variable requerida ausente"))
    if results:
        return results

    for role_name, config in ROLE_CONFIG.items():
        missing = missing_credentials(role_name, env)
        if missing:
            results.extend(missing)
            continue

        session, sign_in_result = sign_in(
            supabase_url,
            anon_key,
            role_name,
            env[config["email"]],
            env[config["password"]],
            client_factory=auth_client_factory,
        )
        results.append(sign_in_result)
        if not session:
            continue

        with rest_client_factory(supabase_url, anon_key, session.access_token) as client:
            results.extend(check_role(session, client, config))

    return results


def main() -> int:
    load_env_file(SERVICE / ".env")
    load_env_file(WEB / ".env.local")
    print("PrediGol - verificacion autenticada de roles Supabase")
    print("Credenciales: leidas desde variables de entorno; no se muestran secretos.")
    results = run()
    print_results(results)
    failures = [result for result in results if result.status in {"FALLO", "ERROR"}]
    if failures:
        print("\nResumen: validacion autenticada con fallos. Revisa usuarios, RLS, grants o datos reales.")
        return 1
    print("\nResumen: validacion autenticada sin fallos criticos. Pendientes pueden requerir usuarios o datos premium reales.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

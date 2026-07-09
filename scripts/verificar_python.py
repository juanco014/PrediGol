from __future__ import annotations

import importlib.util
import os
import platform
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "prediction-service"


def check_dependency(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def configured(value: str | None) -> bool:
    return bool(value and value.strip())


def print_status(label: str, ok: bool, detail: str = "") -> None:
    state = "OK" if ok else "ADVERTENCIA"
    suffix = f" - {detail}" if detail else ""
    print(f"{label}: {state}{suffix}")


def safe_count(client, table: str, params: dict[str, str] | None = None) -> int | None:
    try:
        return client.count(table, params)
    except Exception:
        return None


def main() -> int:
    print("PrediGol - verificacion de Python")
    print(f"Version: {platform.python_version()} ({sys.executable})")
    print_status("Entorno virtual", sys.prefix != getattr(sys, "base_prefix", sys.prefix), sys.prefix)

    missing = [name for name in ["httpx"] if not check_dependency(name)]
    if missing:
        print(f"ERROR: faltan dependencias: {', '.join(missing)}")
        print("Instala con: pip install -r requirements.txt")
        return 1

    print("Dependencias: OK")

    from predigol_model.config import load_env_file, load_settings
    from predigol_model.diagnostics import fetch_matches, fetch_prediction_rows, finished_history
    from predigol_model.poisson_elo import parse_date
    from predigol_model.supabase_client import SupabaseRestClient

    env_file = SERVICE / ".env"
    print_status("prediction-service/.env", env_file.exists(), "existe" if env_file.exists() else "no existe")
    load_env_file(env_file)
    has_url = configured(os.environ.get("SUPABASE_URL"))
    has_service_key = configured(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
    print_status("SUPABASE_URL", has_url, "configurada" if has_url else "faltante o vacia")
    print_status("SUPABASE_SERVICE_ROLE_KEY", has_service_key, "configurada" if has_service_key else "faltante o vacia")

    if not has_url or not has_service_key:
        print("Supabase: sin configurar. Completa prediction-service/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
        print("No se muestran secretos en consola. No uses variables VITE_* para service role.")
        return 0

    try:
        settings = load_settings()
        client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        matches = fetch_matches(client, settings.history_limit)
        predictions = fetch_prediction_rows(client, settings.history_limit)
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: no fue posible conectar a Supabase: {error}")
        return 1

    finalizados = [match for match in matches if match.get("estado") == "finalizado"]
    historicos = finished_history(matches)
    dates = []
    for match in historicos:
        try:
            dates.append(parse_date(match.get("fecha_orden")))
        except Exception:
            pass
    tournaments = Counter(str(match.get("torneo") or "Sin torneo") for match in historicos)
    pending_aliases = safe_count(client, "team_aliases", {"status": "eq.pending_review", "active": "eq.true"})
    table_counts = {
        "model_runs": safe_count(client, "model_runs"),
        "model_datasets": safe_count(client, "model_datasets"),
        "team_aliases": safe_count(client, "team_aliases"),
    }
    print("Supabase: conexion OK")
    for table, count in table_counts.items():
        print_status(f"Tabla {table}", count is not None, f"filas: {count}" if count is not None else "no accesible o no existe")
    print(f"Partidos historicos disponibles: {len(historicos)}")
    print(f"Partidos finalizados: {len(finalizados)}")
    print(f"Rango de fechas: {min(dates).isoformat() if dates else 'N/D'} a {max(dates).isoformat() if dates else 'N/D'}")
    print(f"Torneos disponibles: {len(tournaments)}")
    for tournament, count in sorted(tournaments.items()):
        print(f"- {tournament}: {count}")
    print(f"Aliases pendientes: {pending_aliases if pending_aliases is not None else 'N/D'}")
    print(f"Predicciones/registros de modelo: {len(predictions)}")
    warnings = []
    if len(historicos) < settings.min_history_matches:
        warnings.append(f"Historicos insuficientes para entrenar: {len(historicos)} de {settings.min_history_matches}.")
    if table_counts["model_runs"] is None or table_counts["model_datasets"] is None or table_counts["team_aliases"] is None:
        warnings.append("Faltan tablas administrativas o no son accesibles; aplica/verifica migraciones.")
    if pending_aliases:
        warnings.append("Hay aliases pendientes; no consideres metricas definitivas hasta revisarlos.")
    if warnings:
        print("Advertencias:")
        for warning in warnings:
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

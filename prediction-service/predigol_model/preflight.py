from __future__ import annotations

import importlib.util
import os
import platform
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .api_football_importer import ApiFootballAuthError, ApiFootballClient, ApiFootballError, ApiFootballRateLimitError
from .config import load_env_file
from .data_quality import build_data_quality_report
from .diagnostics import fetch_matches, finished_history
from .supabase_client import SupabaseRestClient


Status = str


@dataclass(frozen=True)
class PreflightItem:
    category: str
    status: Status
    message: str


def dependency_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def add(items: list[PreflightItem], category: str, status: Status, message: str) -> None:
    items.append(PreflightItem(category, status, message))


def safe_count(client: SupabaseRestClient, table: str, params: dict[str, str] | None = None) -> int | None:
    try:
        return client.count(table, params)
    except Exception:
        return None


def build_preflight(root: Path, league: str | None = None, season: str | None = None) -> tuple[list[PreflightItem], str]:
    service = root / "prediction-service"
    env_path = service / ".env"
    items: list[PreflightItem] = []

    add(items, "Python", "OK", f"Python {platform.python_version()}")
    add(items, "Entorno virtual", "OK" if sys.prefix != getattr(sys, "base_prefix", sys.prefix) else "ADVERTENCIA", sys.prefix)
    missing = [name for name in ["httpx"] if not dependency_available(name)]
    add(items, "Dependencias", "OK" if not missing else "BLOQUEADO", "OK" if not missing else f"Faltan: {', '.join(missing)}")
    add(items, "Archivo .env", "OK" if env_path.exists() else "BLOQUEADO", "prediction-service/.env existe" if env_path.exists() else "Falta prediction-service/.env")
    load_env_file(env_path)
    supabase_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    api_key = os.environ.get("API_FOOTBALL_KEY", "").strip()
    api_base_url = os.environ.get("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io").strip().rstrip("/")
    add(items, "SUPABASE_URL", "OK" if supabase_url else "BLOQUEADO", "configurada" if supabase_url else "faltante o vacia")
    add(items, "SUPABASE_SERVICE_ROLE_KEY", "OK" if service_key else "BLOQUEADO", "configurada" if service_key else "faltante o vacia")
    add(items, "API_FOOTBALL_KEY", "OK" if api_key else "BLOQUEADO", "configurada sin mostrar valor" if api_key else "faltante o vacia")
    add(items, "API privada en frontend", "OK" if not os.environ.get("VITE_API_FOOTBALL_KEY") else "BLOQUEADO", "sin VITE_API_FOOTBALL_KEY" if not os.environ.get("VITE_API_FOOTBALL_KEY") else "no uses VITE_* para claves privadas")

    if api_key:
        try:
            api_client = ApiFootballClient(api_key, api_base_url)
            status = api_client.status()
            account = status.get("response", {}).get("account", {}) if isinstance(status, dict) else {}
            requests = status.get("response", {}).get("requests", {}) if isinstance(status, dict) else {}
            add(items, "API-Football", "OK", f"autenticada; plan={account.get('plan', 'desconocido')}")
            if requests:
                add(items, "Cuota API", "OK" if requests.get("current") != requests.get("limit_day") else "ADVERTENCIA", "cuota consultada sin mostrar secretos")
            if league:
                leagues = api_client.list_leagues(league=league, season=season)
                add(items, "Liga API", "OK" if leagues else "BLOQUEADO", f"liga {league} {'disponible' if leagues else 'no devuelta por API/plan'}")
                if season:
                    sample = api_client.fixtures({"league": league, "season": season, "page": 1})
                    status = "OK" if sample.raw_count >= 10 else "ADVERTENCIA" if sample.raw_count > 0 else "BLOQUEADO"
                    add(items, "Temporada API", status, f"{sample.raw_count} fixtures devueltos para liga={league}, temporada={season}")
        except ApiFootballAuthError as error:
            add(items, "API-Football", "BLOQUEADO", f"autenticacion/plan: {error}")
        except ApiFootballRateLimitError as error:
            add(items, "Cuota API", "BLOQUEADO", f"limite de cuota: {error}")
        except ApiFootballError as error:
            add(items, "API-Football", "BLOQUEADO", f"no responde correctamente: {error}")
        except Exception as error:  # noqa: BLE001
            add(items, "API-Football", "BLOQUEADO", f"validacion fallida: {error}")

    if missing or not env_path.exists() or not supabase_url or not service_key:
        return items, "La infraestructura local esta lista parcialmente, pero faltan credenciales de Supabase e historicos reales."

    try:
        client = SupabaseRestClient(supabase_url, service_key)
        matches = fetch_matches(client, int(os.environ.get("PREDIGOL_HISTORY_LIMIT", "2000")))
        add(items, "Conexion Supabase", "OK", "conexion REST correcta")
    except Exception as error:  # noqa: BLE001
        add(items, "Conexion Supabase", "BLOQUEADO", f"no fue posible conectar: {error}")
        return items, "Supabase esta configurado, pero la conexion esta bloqueada."

    required_tables = ["partidos", "model_runs", "model_datasets", "team_aliases"]
    table_counts: dict[str, int | None] = {}
    for table in required_tables:
        table_counts[table] = safe_count(client, table)
        add(items, "Tablas requeridas", "OK" if table_counts[table] is not None else "BLOQUEADO", f"{table}: {table_counts[table] if table_counts[table] is not None else 'no accesible o no existe'}")

    try:
        client.rpc("obtener_model_admin_summary")
        add(items, "RPCs requeridas", "OK", "obtener_model_admin_summary ejecuta con credencial de servidor")
    except Exception as error:  # noqa: BLE001
        add(items, "RPCs requeridas", "BLOQUEADO", f"obtener_model_admin_summary no disponible o sin permisos: {error}")
    add(items, "RPCs requeridas", "ADVERTENCIA", "guardar_team_alias y actualizar_estado_team_alias no se ejecutan en preflight porque modifican datos")

    if table_counts.get("model_runs") is not None and table_counts.get("model_datasets") is not None and table_counts.get("team_aliases") is not None:
        add(items, "Migraciones detectadas", "OK", "tablas administrativas accesibles")
        add(items, "Permisos/RLS", "OK", "service_role puede operar; valida usuario no admin en Supabase")
    else:
        add(items, "Migraciones detectadas", "BLOQUEADO", "faltan tablas administrativas")
        add(items, "Permisos/RLS", "BLOQUEADO", "no se pueden validar permisos sin tablas")

    history = finished_history(matches)
    tournaments = sorted({str(match.get("torneo") or "Sin torneo") for match in history})
    teams = sorted({name for match in history for name in [match.get("local_nombre"), match.get("visitante_nombre")] if name})
    pending_aliases = safe_count(client, "team_aliases", {"status": "eq.pending_review", "active": "eq.true"}) or 0
    datasets = table_counts.get("model_datasets")
    runs = table_counts.get("model_runs")
    quality = build_data_quality_report(matches, pending_aliases=pending_aliases)

    add(items, "Cantidad de historicos", "OK" if history else "BLOQUEADO", f"{len(history)} partidos con marcador")
    add(items, "Partidos finalizados", "OK" if history else "BLOQUEADO", f"{len([m for m in matches if m.get('estado') == 'finalizado'])}")
    add(items, "Rango de fechas", "OK" if quality["date_from"] else "ADVERTENCIA", f"{quality['date_from']} a {quality['date_to']}")
    add(items, "Torneos", "OK" if tournaments else "ADVERTENCIA", f"{len(tournaments)} torneos")
    add(items, "Equipos", "OK" if teams else "ADVERTENCIA", f"{len(teams)} equipos")
    add(items, "Aliases pendientes", "OK" if pending_aliases == 0 else "ADVERTENCIA", str(pending_aliases))
    add(items, "Datasets", "OK" if datasets else "ADVERTENCIA", str(datasets or 0))
    add(items, "Model runs", "OK" if runs else "ADVERTENCIA", str(runs or 0))
    add(items, "Calidad de datos", "OK" if not quality["preliminary"] else "ADVERTENCIA", "; ".join(quality["warnings"]) or "sin advertencias")
    add(items, "Preparacion import API dry-run", "OK" if api_key else "BLOQUEADO", "lista" if api_key else "requiere API_FOOTBALL_KEY")
    add(items, "Preparacion import API --confirm", "OK" if api_key and supabase_url and service_key else "BLOQUEADO", "lista" if api_key and supabase_url and service_key else "requiere API_FOOTBALL_KEY y SUPABASE_SERVICE_ROLE_KEY")
    add(items, "Preparacion para importacion", "OK", "CSV sigue disponible; API recomendada para historicos")
    backtest_status = "OK" if not quality["preliminary"] else "ADVERTENCIA"
    add(items, "Preparacion para backtest V1", backtest_status, "requiere historicos suficientes y aliases revisados")
    add(items, "Preparacion para backtest V2", backtest_status, "requiere historicos suficientes y aliases revisados")
    add(items, "Preparacion para comparacion V1 vs V2", backtest_status, "debe evaluar exactamente el mismo conjunto temporal")

    if quality["preliminary"]:
        return items, "El sistema esta listo para importar y ejecutar validaciones preliminares, pero todavia no hay datos suficientes o limpios para un backtest comparativo confiable."
    return items, "El sistema esta listo para importar y ejecutar backtests preliminares. No se debe concluir que V2 es superior hasta revisar estabilidad por torneo y temporada."


def format_preflight(items: list[PreflightItem], conclusion: str) -> str:
    width = max([len(item.category) for item in items] + [9])
    lines = ["PrediGol - preflight modelos", "", f"{'Categoria'.ljust(width)}  Estado       Detalle"]
    lines.append(f"{'-' * width}  -----------  {'-' * 50}")
    for item in items:
        lines.append(f"{item.category.ljust(width)}  {item.status.ljust(11)}  {item.message}")
    lines.extend(["", f"Conclusion: {conclusion}"])
    return "\n".join(lines)

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
sys.path.insert(0, str(ROOT / "prediction-service"))

from predigol_model.comparative_backtest import compare_v1_v2, write_comparison_reports
from predigol_model.config import load_settings
from predigol_model.diagnostics import fetch_matches, finished_history
from predigol_model.supabase_client import SupabaseRestClient
from predigol_model.traceability import build_dataset_metadata, build_run_payload, insert_dataset, insert_model_run
from predigol_model.v2 import V2Config


def display_path(path: str) -> str:
    try:
        return str(Path(path).relative_to(ROOT))
    except ValueError:
        return path


def count_pending_aliases(client: SupabaseRestClient) -> int:
    try:
        rows = client.select(
            "team_aliases",
            {"select": "id", "status": "eq.pending_review", "active": "eq.true", "limit": "10000"},
        )
        return len(rows)
    except Exception:
        return 0


def load_dataset_file(path: Path) -> list[dict[str, object]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        matches = data.get("matches", [])
    else:
        matches = data
    if not isinstance(matches, list):
        raise ValueError("El dataset debe ser una lista o un objeto JSON con clave matches.")
    return [dict(match) for match in matches]


def dataset_metadata(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    matches = data.get("matches", []) if isinstance(data, dict) else data
    if not isinstance(matches, list):
        matches = []
    finished = [match for match in matches if match.get("estado") == "finalizado"]
    dates = sorted(str(match.get("fecha_orden")) for match in matches if match.get("fecha_orden"))
    quality = data.get("quality", {}) if isinstance(data, dict) else {}
    return {
        "file": display_path(str(path)),
        "name": data.get("name") if isinstance(data, dict) else path.stem,
        "provider": data.get("provider") if isinstance(data, dict) else None,
        "league_id": data.get("league_id") if isinstance(data, dict) else None,
        "season": data.get("season") if isinstance(data, dict) else None,
        "total_matches": len(matches),
        "finished_matches": len(finished),
        "pending_or_ignored_matches": len(matches) - len(finished),
        "date_from": dates[0] if dates else None,
        "date_to": dates[-1] if dates else None,
        "quality_status": quality.get("status") if isinstance(quality, dict) else None,
        "checksum": data.get("checksum") if isinstance(data, dict) else None,
    }


def resolve_dataset_paths(dataset: str | None, datasets: list[str] | None, dataset_glob: str | None) -> list[Path]:
    paths: list[Path] = []
    if dataset:
        paths.append(Path(dataset))
    for item in datasets or []:
        paths.append(Path(item))
    if dataset_glob:
        paths.extend(Path(path) for path in glob.glob(dataset_glob))
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            unique.append(path)
            seen.add(resolved)
    return unique


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backtest comparativo V1 vs V2.")
    parser.add_argument("--date-from")
    parser.add_argument("--date-to")
    parser.add_argument("--tournament", action="append", default=[])
    parser.add_argument("--season", type=int)
    parser.add_argument("--dataset", help="Ruta JSON generada por importar_temporada_api.py. Si se omite, usa Supabase.")
    parser.add_argument("--datasets", nargs="+", help="Rutas JSON de varias temporadas para combinar en orden cronologico.")
    parser.add_argument("--dataset-glob", help="Patron glob para combinar datasets locales, por ejemplo reports/*_dataset.json.")
    parser.add_argument("--min-training", type=int)
    parser.add_argument("--disable-calibration", action="store_true")
    parser.add_argument("--disable-dixon-coles", action="store_true")
    parser.add_argument("--register", action="store_true", help="Guarda dataset y run en Supabase si las tablas existen.")
    args = parser.parse_args(argv)

    client = None
    settings = None
    pending_aliases = 0
    dataset_paths = resolve_dataset_paths(args.dataset, args.datasets, args.dataset_glob)
    dataset_sources: list[dict[str, Any]] = []
    if (args.dataset or args.datasets or args.dataset_glob) and not dataset_paths:
        print("ERROR: no se encontraron datasets locales con los parametros indicados.")
        return 1
    if dataset_paths:
        missing = [str(path) for path in dataset_paths if not path.exists()]
        if missing:
            print(f"ERROR: datasets no encontrados: {', '.join(missing)}")
            return 1
        matches = []
        for path in dataset_paths:
            matches.extend(load_dataset_file(path))
            dataset_sources.append(dataset_metadata(path))
        history = finished_history(matches)
        min_training = args.min_training or 30
    else:
        try:
            settings = load_settings()
        except RuntimeError as error:
            print(f"ERROR: {error}")
            print("Configura prediction-service/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de usar datos reales.")
            return 1
        client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        matches = fetch_matches(client, settings.history_limit)
        history = finished_history(matches)
        pending_aliases = count_pending_aliases(client)
        min_training = args.min_training or settings.min_history_matches
    v2_config = V2Config(
        calibration_min_matches=10**9 if args.disable_calibration else V2Config().calibration_min_matches,
        dixon_coles_enabled=not args.disable_dixon_coles,
    )
    result = compare_v1_v2(
        history,
        min_training_matches=min_training,
        date_from=args.date_from,
        date_to=args.date_to,
        tournaments=args.tournament,
        season=args.season,
        v2_config=v2_config,
        pending_aliases=pending_aliases,
    )
    raw_matches_count = len(matches)
    ignored_non_finished = raw_matches_count - len(history)
    seasons = sorted({int(match.get("temporada")) for match in history if str(match.get("temporada") or "").isdigit()})
    tournaments = sorted({str(match.get("torneo")) for match in history if match.get("torneo")})
    leakage_warnings = [
        "Backtest cronologico: cada prediccion usa solo partidos anteriores a la fecha evaluada.",
        "No se usan standings finales ni estadisticas posteriores dentro de este script.",
    ]
    if ignored_non_finished:
        leakage_warnings.append(f"Se ignoraron {ignored_non_finished} partidos no finalizados para evitar entrenar con pendientes.")
    if dataset_paths and len(seasons) <= 1:
        leakage_warnings.append("Dataset local con una sola temporada: la validacion puede ser debil; usa historico previo para evaluar 2025-2026.")
    if dataset_paths and len(seasons) > 1 and args.season is None and not args.date_from:
        leakage_warnings.append("Se combinaron varias temporadas sin --season ni --date-from; el backtest sigue siendo cronologico, pero no define holdout reciente explicito.")
    result["dataset_sources"] = dataset_sources
    result["source_summary"] = {
        "raw_matches": raw_matches_count,
        "finished_matches_used": len(history),
        "ignored_non_finished_matches": ignored_non_finished,
        "tournaments": tournaments,
        "seasons": seasons,
    }
    result["anti_leakage"] = {"warnings": leakage_warnings}
    report_paths = write_comparison_reports(result, REPORTS)
    dataset_row = None

    if args.register:
        if client is None:
            print("ERROR: --register requiere Supabase; no se registra cuando --dataset es un archivo local.")
            return 1
        dataset = build_dataset_metadata(
            "Backtest comparativo V1 vs V2",
            matches,
            history,
            [match for match in matches if match not in history],
            source_type="supabase",
            source_name="partidos",
            description="Dataset generado desde Supabase para backtest comparativo.",
        )
        dataset_row = insert_dataset(client, dataset)
        insert_model_run(
            client,
            build_run_payload(
                model_version="V1_vs_V2",
                run_type="backtest",
                status="completed",
                available_matches=len(matches),
                used_matches=result["evaluated_matches"],
                discarded_matches=len(result["excluded_matches"]),
                dataset_id=dataset_row.get("id") if dataset_row else None,
                metrics=result["summaries"],
                warnings=[result["interpretation"], *result.get("data_quality", {}).get("warnings", [])],
                model_config=result["config"],
                date_from=args.date_from,
                date_to=args.date_to,
                tournaments=args.tournament,
                admin_notes=f"Reportes: {{'json': '{display_path(report_paths['json'])}', 'csv': '{display_path(report_paths['csv'])}'}}",
            ),
        )

    print(f"Partidos evaluados: {result['evaluated_matches']}")
    print(result["interpretation"])
    print(f"Reporte JSON: {display_path(report_paths['json'])}")
    print(f"Reporte CSV: {display_path(report_paths['csv'])}")
    if not args.register:
        print("No se registro en Supabase. Usa --register para guardar model_runs/model_datasets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

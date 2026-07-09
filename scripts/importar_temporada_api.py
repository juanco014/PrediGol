from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))
sys.path.insert(0, str(ROOT))

from predigol_model.data_quality import validate_imported_dataset
from predigol_model.external_football_api import create_external_football_api
from predigol_model.config import load_settings
from predigol_model.supabase_client import SupabaseRestClient
from predigol_model.traceability import stable_checksum

from scripts.importar_temporada import confirm_import, display_path, existing_duplicates, fetch_normalizer, write_import_reports


REPORTS = ROOT / "reports"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Importar una temporada desde una API externa de futbol.")
    parser.add_argument("--provider", default="api_football")
    parser.add_argument("--league", help="Nombre de liga para resolver contra el proveedor.")
    parser.add_argument("--league-id", help="ID de liga del proveedor. Preferido para importaciones reproducibles.")
    parser.add_argument("--country", help="Pais para desambiguar --league cuando aplique.")
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--include-upcoming", action="store_true", help="Incluye partidos pendientes en el dataset importado.")
    parser.add_argument("--dry-run", action="store_true", help="Consulta y valida sin escribir en Supabase.")
    parser.add_argument("--save", action="store_true", help="Guarda partidos, dataset y model_run en Supabase.")
    parser.add_argument("--save-local", action="store_true", help="Guarda dataset y reportes locales sin usar Supabase.")
    parser.add_argument("--output", default=str(REPORTS), help="Directorio para reportes/datasets locales.")
    parser.add_argument("--dataset-name")
    return parser


def resolve_league_id(api, league_id: str | None, league: str | None, season: int, country: str | None) -> str:
    if league_id:
        return str(league_id)
    if not league:
        raise ValueError("Usa --league-id o --league.")
    return str(api.client.resolve_league_id(league, season=season, country=country))


def write_dataset_file(result, provider: str, league_id: str, season: int, quality: dict[str, Any], report_base: Path) -> Path:
    dataset_path = report_base.with_name(f"{report_base.name}_dataset.json")
    dataset_payload = {
        "name": f"{provider} league {league_id} season {season}",
        "provider": provider,
        "league_id": league_id,
        "season": season,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "checksum": stable_checksum([row.get("payload_api", {}).get("internal_match") for row in result.valid]),
        "quality": quality,
        "matches": result.valid,
    }
    dataset_path.write_text(json.dumps(dataset_payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return dataset_path


def summarize_import(result, fetched, quality: dict[str, Any], duplicates: dict[str, set[object]], provider: str, league_id: str, season: int, report_paths: dict[str, Path], dataset_path: Path, dataset_row: dict[str, Any] | None) -> dict[str, Any]:
    finished = [row for row in result.valid if row.get("estado") == "finalizado"]
    pending = [row for row in result.valid if row.get("estado") != "finalizado"]
    dates = sorted(row.get("fecha_orden") for row in result.valid if row.get("fecha_orden"))
    return {
        "provider": provider,
        "league_id": league_id,
        "season": season,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "matches_found": fetched.raw_count,
        "valid_matches": len(result.valid),
        "finished_matches": len(finished),
        "pending_matches": len(pending),
        "omitted_matches": len(result.discarded),
        "duplicates_in_payload": len(result.duplicates),
        "duplicates_against_supabase": {
            "by_identifier": len(duplicates.get("api_football_fixture_id", set())),
            "by_fallback": len(duplicates.get("fallback", set())),
        },
        "errors": quality.get("errors", []),
        "warnings": [*quality.get("warnings", []), *fetched.warnings],
        "date_range": {"from": dates[0] if dates else None, "to": dates[-1] if dates else None},
        "checksum": stable_checksum([row.get("payload_api", {}).get("internal_match") for row in result.valid]),
        "quality_status": quality["status"],
        "valid_for_training": quality["valid_for_training"],
        "stored_at": "Supabase: partidos/model_datasets/model_runs" if dataset_row else "reports solamente",
        "dataset_id": dataset_row.get("id") if dataset_row else None,
        "dataset_file": display_path(dataset_path),
        "report_json": display_path(report_paths["json"]),
        "report_csv": display_path(report_paths["csv"]),
    }


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    selected_modes = sum(1 for enabled in [args.dry_run, args.save, args.save_local] if enabled)
    if selected_modes > 1:
        parser.error("Usa solo uno de: --dry-run, --save o --save-local.")
    dry_run = not args.save and not args.save_local

    try:
        supabase_client = None
        normalizer = None
        if args.save:
            try:
                settings = load_settings()
            except RuntimeError as error:
                print(
                    "ERROR: --save guarda en Supabase y requiere SUPABASE_URL y "
                    f"SUPABASE_SERVICE_ROLE_KEY en prediction-service/.env ({error}). "
                    "Para guardar solo archivos locales usa --save-local."
                )
                return 1
            supabase_client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
            normalizer = fetch_normalizer(supabase_client)

        api = create_external_football_api(provider=args.provider, normalizer=normalizer, dry_run=dry_run)
        league_id = resolve_league_id(api, args.league_id, args.league, args.season, args.country)
        result, fetched = api.importer.import_season(league_id, args.season, include_upcoming=args.include_upcoming)
        quality = validate_imported_dataset(result.valid, expected_season=args.season)

        reports_dir = Path(args.output)
        reports_dir.mkdir(exist_ok=True)
        stem = f"api_{api.provider}_liga-{league_id}_temporada-{args.season}"
        duplicates = {"api_football_fixture_id": set(), "fallback": set()}
        if supabase_client is not None and result.valid:
            duplicates = existing_duplicates(supabase_client, result.valid)
        report_paths = write_import_reports(result, reports_dir / stem, duplicates)
        dataset_path = write_dataset_file(result, api.provider, league_id, args.season, quality, reports_dir / stem)

        dataset_row = None
        if args.save:
            if not quality["valid_for_training"]:
                print("BLOQUEADO: el dataset no paso validacion de calidad; no se guardo.")
                print(json.dumps(quality, ensure_ascii=False, indent=2))
                return 1
            confirmation = confirm_import(
                supabase_client,
                Path("api_football_import"),
                args.dataset_name or f"{api.provider} liga {league_id} temporada {args.season}",
                result,
                report_paths["json"],
                source_type="api",
                source_name=api.provider,
                run_type="api_import",
                model_config={
                    "provider": api.provider,
                    "league_id": league_id,
                    "league": args.league,
                    "season": args.season,
                    "include_upcoming": args.include_upcoming,
                    "quality": quality,
                },
            )
            dataset_row = confirmation["dataset"]
        elif args.save_local:
            if not quality["valid_for_training"]:
                print("ADVERTENCIA: dataset local guardado, pero no es valido para entrenamiento hasta corregir calidad.")
            print("Save-local: se escribieron reportes y dataset local. No se uso Supabase.")
        else:
            print("Dry-run: no se escribio en Supabase. Usa --save-local para dataset local o --save para Supabase.")

        summary = summarize_import(result, fetched, quality, duplicates, api.provider, league_id, args.season, report_paths, dataset_path, dataset_row)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 1
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: no fue posible importar temporada por API: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

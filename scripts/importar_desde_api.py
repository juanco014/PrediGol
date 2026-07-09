from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))
sys.path.insert(0, str(ROOT))

from predigol_model.api_football_importer import PROVIDER_NAME, ApiFootballClient, ApiFootballImporter
from predigol_model.config import load_api_football_settings, load_settings
from predigol_model.supabase_client import SupabaseRestClient

from scripts.importar_temporada import confirm_import, display_path, existing_duplicates, fetch_normalizer, write_import_reports


REPORTS = ROOT / "reports"


def client_and_importer(use_supabase_aliases: bool = True) -> tuple[ApiFootballClient, ApiFootballImporter]:
    api_key, base_url = load_api_football_settings()
    api_client = ApiFootballClient(api_key, base_url)
    normalizer = None
    if use_supabase_aliases:
        try:
            settings = load_settings()
            normalizer = fetch_normalizer(SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key))
        except Exception:
            normalizer = None
    return api_client, ApiFootballImporter(api_client, normalizer)


def print_json(data: object) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Importar historicos desde API-Football/API-Sports.")
    parser.add_argument("--listar-ligas", action="store_true")
    parser.add_argument("--listar-temporadas", action="store_true")
    parser.add_argument("--liga")
    parser.add_argument("--pais")
    parser.add_argument("--temporada")
    parser.add_argument("--desde")
    parser.add_argument("--hasta")
    parser.add_argument("--solo-finalizados", action="store_true")
    parser.add_argument("--incluir-proximos", action="store_true")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--confirm", action="store_true")
    parser.add_argument("--dataset-name", default="Importacion API-Football")
    args = parser.parse_args()

    try:
        api_client, importer = client_and_importer()
        api_client.status()
    except Exception as error:  # noqa: BLE001
        print(f"BLOQUEADO: no fue posible validar API-Football: {error}")
        return 1

    if args.listar_ligas:
        leagues = importer.list_leagues(country=args.pais)
        print_json([
            {
                "league_id": item.get("league", {}).get("id"),
                "name": item.get("league", {}).get("name"),
                "country": item.get("country", {}).get("name"),
                "seasons": [season.get("year") for season in item.get("seasons", [])],
            }
            for item in leagues
        ])
        return 0

    if args.listar_temporadas:
        if not args.liga:
            raise SystemExit("--liga es obligatorio para --listar-temporadas")
        print_json(importer.list_seasons(args.liga))
        return 0

    if not args.liga:
        raise SystemExit("--liga es obligatorio")
    if not args.temporada and not (args.desde and args.hasta):
        raise SystemExit("Usa --temporada o --desde/--hasta")

    if args.desde and args.hasta:
        result, fetched = importer.import_range(args.liga, args.temporada, args.desde, args.hasta, args.solo_finalizados, args.incluir_proximos)
    else:
        result, fetched = importer.import_season(args.liga, args.temporada, include_upcoming=args.incluir_proximos)

    REPORTS.mkdir(exist_ok=True)
    stem = f"api_football_liga-{args.liga}_temporada-{args.temporada or 'rango'}"
    supabase_client = None
    duplicates = {"api_football_fixture_id": set(), "fallback": set()}
    try:
        settings = load_settings()
        supabase_client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        duplicates = existing_duplicates(supabase_client, result.valid)
    except Exception:
        if args.confirm:
            raise
    report_paths = write_import_reports(result, REPORTS / stem, duplicates)

    dataset_row = None
    if args.confirm:
        if supabase_client is None:
            raise RuntimeError("Supabase es obligatorio para --confirm")
        confirmation = confirm_import(
            supabase_client,
            Path("api_football_import"),
            args.dataset_name,
            result,
            report_paths["json"],
            source_type="api",
            source_name=PROVIDER_NAME,
            run_type="api_import",
            model_config={"provider": PROVIDER_NAME, "league": args.liga, "season": args.temporada, "from": args.desde, "to": args.hasta},
        )
        dataset_row = confirmation["dataset"]
        print(f"Importacion confirmada: {len(confirmation['written'])} partidos escritos.")
    else:
        print("Dry-run: no se escribio en Supabase. Usa --confirm para importar.")

    summary = result.summary()
    summary.update({
        "provider": fetched.provider,
        "raw_api_matches": fetched.raw_count,
        "api_requests": fetched.requests_count,
        "quota": fetched.quota.__dict__ if fetched.quota else None,
        "dataset_id": dataset_row.get("id") if dataset_row else None,
    })
    print_json(summary)
    print(f"Reporte JSON: {display_path(report_paths['json'])}")
    print(f"Reporte CSV: {display_path(report_paths['csv'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

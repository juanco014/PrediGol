from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))
sys.path.insert(0, str(ROOT))

from predigol_model.config import load_api_football_settings, load_settings
from predigol_model.api_football_importer import ApiFootballClient, ApiFootballImporter
from predigol_model.supabase_client import SupabaseRestClient

from scripts.importar_temporada import confirm_import, fetch_normalizer, write_import_reports


REPORTS = ROOT / "reports"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincronizar partidos recientes y futuros desde API-Football.")
    parser.add_argument("--liga", required=True)
    parser.add_argument("--temporada")
    parser.add_argument("--dias-atras", type=int, default=7)
    parser.add_argument("--dias-adelante", type=int, default=30)
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    try:
        settings = load_settings()
        supabase = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        api_key, base_url = load_api_football_settings()
        importer = ApiFootballImporter(ApiFootballClient(api_key, base_url), fetch_normalizer(supabase))
    except Exception as error:  # noqa: BLE001
        print(f"BLOQUEADO: no fue posible preparar sincronizacion API-Football: {error}")
        return 1
    result, fetched = importer.sync_window(args.liga, args.temporada, args.dias_atras, args.dias_adelante)
    REPORTS.mkdir(exist_ok=True)
    reports = write_import_reports(result, REPORTS / f"sync_api_football_liga-{args.liga}")
    if args.confirm:
        confirmation = confirm_import(
            supabase,
            Path("api_football_sync"),
            "Sincronizacion API-Football",
            result,
            reports["json"],
            source_type="api",
            source_name="api-football",
            run_type="api_import",
            model_config={"provider": "api-football", "league": args.liga, "season": args.temporada, "sync": True},
        )
        print(f"Sincronizacion confirmada: {len(confirmation['written'])} partidos nuevos; {confirmation['existing_count']} ya existian.")
    else:
        print("Dry-run: no se escribio en Supabase. Usa --confirm para sincronizar.")
    print(f"API requests: {fetched.requests_count}; fixtures recibidos: {fetched.raw_count}")
    print(f"Reporte JSON: {reports['json'].relative_to(ROOT)}")
    print(f"Reporte CSV: {reports['csv'].relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json

from predigol_model.config import load_settings
from predigol_model.diagnostics import (
    build_model_diagnostics,
    fetch_matches,
    fetch_prediction_rows,
    summarize_for_console,
)
from predigol_model.supabase_client import SupabaseRestClient


def main() -> int:
    try:
        settings = load_settings()
    except RuntimeError as error:
        print(f"ERROR: {error}")
        print("Configura prediction-service/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de usar datos reales.")
        return 1
    client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
    matches = fetch_matches(client, settings.history_limit)
    predictions = fetch_prediction_rows(client, settings.history_limit)
    diagnostics = build_model_diagnostics(matches, predictions, settings.min_history_matches, "V1")

    print(summarize_for_console(diagnostics))
    print("\nDetalle JSON:")
    print(json.dumps(diagnostics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

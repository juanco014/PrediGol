from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"

from predigol_model.config import load_settings
from predigol_model.diagnostics import fetch_matches, finished_history
from predigol_model.evaluation import evaluate_temporal_holdout
from predigol_model.poisson_elo import MODEL_VERSION, PoissonEloModel
from predigol_model.supabase_client import SupabaseRestClient
from predigol_model.v2 import MODEL_VERSION_V2, PoissonEloFormModel

MODELS = {
    "V1": (PoissonEloModel, MODEL_VERSION),
    "V2": (PoissonEloFormModel, MODEL_VERSION_V2),
}


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Backtest temporal rolling-origin de PrediGol.")
    parser.add_argument("--model", choices=sorted(MODELS), default="V1")
    parser.add_argument("--test-ratio", type=float, default=0.2)
    parser.add_argument("--min-test", type=int, default=10)
    args = parser.parse_args()

    try:
        settings = load_settings()
    except RuntimeError as error:
        print(f"ERROR: {error}")
        print("Configura prediction-service/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de usar datos reales.")
        return 1
    client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
    matches = fetch_matches(client, settings.history_limit)
    history = finished_history(matches)
    model_class, model_version = MODELS[args.model]
    result = evaluate_temporal_holdout(
        history,
        test_ratio=args.test_ratio,
        min_training_matches=settings.min_history_matches,
        min_test_matches=args.min_test,
        model_class=model_class,
        model_version=model_version,
    )

    REPORTS.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = REPORTS / f"backtest_{args.model.lower()}_{stamp}.json"
    report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Modelo: {result['model_version']}")
    print(f"Partidos evaluados: {result['test_matches']}")
    print(f"Brier Score: {result['brier_score']}")
    print(f"Log Loss: {result['log_loss']}")
    print(f"MAE goles L/V: {result['home_goals_mae']} / {result['away_goals_mae']}")
    print(f"Reporte: {display_path(report_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

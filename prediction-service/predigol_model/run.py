from __future__ import annotations

import argparse
import json
from collections import Counter
from typing import Any

from .config import load_settings
from .evaluation import evaluate_temporal_holdout
from .poisson_elo import MODEL_VERSION, PoissonEloModel
from .supabase_client import SupabaseRestClient
from .team_normalization import TeamNormalizer, normalize_match_teams
from .v2 import MODEL_VERSION_V2, PoissonEloFormModel


MODEL_REGISTRY = {
    "V1": (PoissonEloModel, MODEL_VERSION),
    "V2": (PoissonEloFormModel, MODEL_VERSION_V2),
}


def fetch_finished_matches(client: SupabaseRestClient, limit: int) -> list[dict[str, Any]]:
    return client.select(
        "partidos",
        {
            "select": (
                "id,api_football_fixture_id,torneo,fecha_orden,local_nombre,"
                "visitante_nombre,goles_local_final,goles_visitante_final,estado,"
                "origen_datos,external_source,es_relevante"
            ),
            "estado": "eq.finalizado",
            "goles_local_final": "not.is.null",
            "goles_visitante_final": "not.is.null",
            "order": "fecha_orden.desc",
            "limit": str(limit),
        },
    )


def fetch_upcoming_matches(client: SupabaseRestClient, limit: int) -> list[dict[str, Any]]:
    return client.select(
        "partidos",
        {
            "select": (
                "id,api_football_fixture_id,torneo,fecha_orden,local_nombre,"
                "visitante_nombre,estado,origen_datos,external_source,es_relevante"
            ),
            "estado": "eq.proximo",
            "api_football_fixture_id": "not.is.null",
            "es_relevante": "eq.true",
            "order": "fecha_orden.asc",
            "limit": str(limit),
        },
    )


def fetch_existing_predictions(client: SupabaseRestClient, limit: int) -> list[dict[str, Any]]:
    return client.select(
        "model_predictions",
        {
            "select": (
                "api_football_fixture_id,partido_id,confidence,model_version,"
                "generated_at"
            ),
            "order": "generated_at.desc",
            "limit": str(limit),
        },
    )


def fetch_alias_normalizer(client: SupabaseRestClient) -> TeamNormalizer:
    try:
        rows = client.select(
            "team_aliases",
            {
                "select": "canonical_name,alias,tournament,country,active,status,confidence,source,notes",
                "active": "eq.true",
                "limit": "5000",
            },
        )
    except Exception:
        return TeamNormalizer()
    return TeamNormalizer.from_supabase_rows(rows)


def normalize_matches(matches: list[dict[str, Any]], normalizer: TeamNormalizer) -> list[dict[str, Any]]:
    return [normalize_match_teams(match, normalizer) for match in matches]


def build_predictions(
    history: list[dict[str, Any]],
    upcoming: list[dict[str, Any]],
    model_key: str = "V1",
) -> list[dict[str, Any]]:
    model_class, _model_version = MODEL_REGISTRY[model_key]
    model = model_class(history)
    return [model.predict(match).to_payload() for match in upcoming]


def count_by(rows: list[dict[str, Any]], field: str, fallback: str = "sin_valor") -> dict[str, int]:
    counter = Counter(str(row.get(field) or fallback) for row in rows)
    return dict(sorted(counter.items(), key=lambda item: (-item[1], item[0])))


def build_diagnostics(
    history: list[dict[str, Any]],
    upcoming: list[dict[str, Any]],
    existing_predictions: list[dict[str, Any]],
    min_history: int,
) -> dict[str, Any]:
    prediction_fixture_ids = {
        prediction.get("api_football_fixture_id")
        for prediction in existing_predictions
        if prediction.get("api_football_fixture_id") is not None
    }
    upcoming_with_prediction = [
        match
        for match in upcoming
        if match.get("api_football_fixture_id") in prediction_fixture_ids
    ]
    missing_upcoming_predictions = max(len(upcoming) - len(upcoming_with_prediction), 0)
    recommendations: list[str] = []

    if len(history) < min_history:
        recommendations.append(
            f"Carga {min_history - len(history)} partidos finalizados mas con marcador."
        )

    if not upcoming:
        recommendations.append(
            "Marca al menos un partido proximo como relevante para generar predicciones visibles."
        )

    if len(history) >= min_history and upcoming and missing_upcoming_predictions:
        recommendations.append(
            "Ejecuta python -m predigol_model.run para guardar predicciones pendientes."
        )

    if not recommendations:
        recommendations.append("El modelo tiene datos suficientes para operar.")

    return {
        "ready_for_training": len(history) >= min_history,
        "ready_for_predictions": len(history) >= min_history and len(upcoming) > 0,
        "history_matches": len(history),
        "min_history_matches": min_history,
        "upcoming_matches": len(upcoming),
        "saved_predictions": len(existing_predictions),
        "upcoming_with_prediction": len(upcoming_with_prediction),
        "missing_upcoming_predictions": missing_upcoming_predictions,
        "latest_prediction_at": existing_predictions[0].get("generated_at")
        if existing_predictions
        else None,
        "history_by_source": count_by(history, "origen_datos"),
        "upcoming_by_source": count_by(upcoming, "origen_datos"),
        "history_by_tournament": count_by(history, "torneo"),
        "upcoming_preview": [
            {
                "id": match.get("id"),
                "fixture_id": match.get("api_football_fixture_id"),
                "torneo": match.get("torneo"),
                "local": match.get("local_nombre"),
                "visitante": match.get("visitante_nombre"),
                "fecha_orden": match.get("fecha_orden"),
            }
            for match in upcoming[:10]
        ],
        "recommendations": recommendations,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate PrediGol model predictions.")
    parser.add_argument("--diagnose", action="store_true", help="Print data readiness without training.")
    parser.add_argument("--dry-run", action="store_true", help="Print predictions without writing Supabase.")
    parser.add_argument("--backtest", action="store_true", help="Evaluate a temporal holdout.")
    parser.add_argument("--test-ratio", type=float, default=0.2)
    parser.add_argument("--min-test", type=int, default=10)
    parser.add_argument("--history-limit", type=int, default=None)
    parser.add_argument("--upcoming-limit", type=int, default=None)
    parser.add_argument("--min-history", type=int, default=None)
    parser.add_argument("--model", choices=sorted(MODEL_REGISTRY.keys()), default="V1")
    args = parser.parse_args()

    settings = load_settings()
    client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
    history_limit = args.history_limit or settings.history_limit
    upcoming_limit = args.upcoming_limit or settings.upcoming_limit
    min_history = args.min_history or settings.min_history_matches

    normalizer = fetch_alias_normalizer(client)
    history = normalize_matches(fetch_finished_matches(client, history_limit), normalizer)
    model_class, model_version = MODEL_REGISTRY[args.model]
    if args.backtest:
        evaluation = evaluate_temporal_holdout(
            history,
            test_ratio=args.test_ratio,
            min_training_matches=min_history,
            min_test_matches=args.min_test,
            model_class=model_class,
            model_version=model_version,
        )

        if not args.dry_run:
            evaluation = client.insert("model_evaluations", evaluation)

        print(json.dumps({"ok": True, "evaluation": evaluation}, ensure_ascii=False, indent=2))
        return

    upcoming = normalize_matches(fetch_upcoming_matches(client, upcoming_limit), normalizer)
    existing_predictions = fetch_existing_predictions(client, upcoming_limit)
    diagnostics = build_diagnostics(history, upcoming, existing_predictions, min_history)

    if args.diagnose:
        print(json.dumps(diagnostics, ensure_ascii=False, indent=2))
        return

    if not history:
        raise RuntimeError("No hay historico finalizado para entrenar el modelo.")

    if len(history) < min_history:
        raise RuntimeError(
            f"Historico insuficiente para entrenar: {len(history)} partidos. "
            f"Minimo configurado: {min_history}."
        )

    if not upcoming:
        print(
            json.dumps(
                {
                    "ok": True,
                    "history_matches": len(history),
                    "upcoming_matches": 0,
                    "predictions_written": 0,
                    "recommendations": diagnostics["recommendations"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    predictions = build_predictions(history, upcoming, args.model)

    if args.dry_run:
        print(
            json.dumps(
                {
                    "ok": True,
                    "history_matches": len(history),
                    "upcoming_matches": len(upcoming),
                    "missing_upcoming_predictions": diagnostics[
                        "missing_upcoming_predictions"
                    ],
                    "predictions": predictions[:10],
                    "recommendations": diagnostics["recommendations"],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    written = client.upsert(
        "model_predictions",
        predictions,
        on_conflict="api_football_fixture_id",
    )

    print(
        json.dumps(
            {
                "ok": True,
                "history_matches": len(history),
                "upcoming_matches": len(upcoming),
                "predictions_written": len(written),
                "latest_prediction_at": written[0].get("generated_at") if written else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from .poisson_elo import parse_date
from .supabase_client import SupabaseRestClient
from .team_normalization import TeamNormalizer, normalize_match_teams


PARTIDOS_SELECT = (
    "id,api_football_fixture_id,torneo,fecha_orden,local_nombre,visitante_nombre,"
    "goles_local_final,goles_visitante_final,estado,origen_datos,external_source,"
    "es_relevante,temporada"
)


def fetch_matches(client: SupabaseRestClient, limit: int = 5000) -> list[dict[str, Any]]:
    return client.select(
        "partidos",
        {
            "select": PARTIDOS_SELECT,
            "order": "fecha_orden.asc",
            "limit": str(limit),
        },
    )


def fetch_prediction_rows(client: SupabaseRestClient, limit: int = 5000) -> list[dict[str, Any]]:
    return client.select(
        "model_predictions",
        {
            "select": "api_football_fixture_id,partido_id,model_version,confidence,generated_at,metadata",
            "order": "generated_at.desc",
            "limit": str(limit),
        },
    )


def fetch_team_aliases(client: SupabaseRestClient, limit: int = 5000) -> list[dict[str, Any]]:
    return client.select(
        "team_aliases",
        {
            "select": "canonical_name,alias,tournament,country,active,status,confidence,source,notes",
            "active": "eq.true",
            "order": "updated_at.desc",
            "limit": str(limit),
        },
    )


def is_finished_with_valid_score(match: dict[str, Any]) -> bool:
    return (
        match.get("estado") == "finalizado"
        and match.get("goles_local_final") is not None
        and match.get("goles_visitante_final") is not None
    )


def finished_history(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [match for match in matches if is_finished_with_valid_score(match)]


def discard_reason(match: dict[str, Any]) -> str | None:
    if match.get("estado") != "finalizado":
        return f"estado_{match.get('estado') or 'sin_estado'}"
    if match.get("goles_local_final") is None or match.get("goles_visitante_final") is None:
        return "sin_marcador_final"
    if not match.get("local_nombre") or not match.get("visitante_nombre"):
        return "sin_equipos"
    if not match.get("fecha_orden"):
        return "sin_fecha_orden"
    return None


def _safe_date_range(matches: list[dict[str, Any]]) -> dict[str, str | None]:
    dates = []
    for match in matches:
        try:
            dates.append(parse_date(match.get("fecha_orden")))
        except ValueError:
            continue
    if not dates:
        return {"desde": None, "hasta": None}
    return {"desde": min(dates).isoformat(), "hasta": max(dates).isoformat()}


def _team_match_counts(matches: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for match in matches:
        if match.get("local_nombre"):
            counts[match["local_nombre"]] += 1
        if match.get("visitante_nombre"):
            counts[match["visitante_nombre"]] += 1
    return dict(sorted(counts.items(), key=lambda item: (item[1], item[0])))


def build_model_diagnostics(
    matches: list[dict[str, Any]],
    predictions: list[dict[str, Any]] | None = None,
    min_history: int = 30,
    model_version: str = "V1",
    normalizer: TeamNormalizer | None = None,
) -> dict[str, Any]:
    predictions = predictions or []
    normalizer = normalizer or TeamNormalizer()
    matches = [normalize_match_teams(match, normalizer) for match in matches]
    valid_history = finished_history(matches)
    discarded_counter: Counter[str] = Counter()
    discarded_examples: list[dict[str, Any]] = []

    for match in matches:
        reason = discard_reason(match)
        if reason:
            discarded_counter[reason] += 1
            if len(discarded_examples) < 12:
                discarded_examples.append(
                    {
                        "id": match.get("id"),
                        "torneo": match.get("torneo"),
                        "local": match.get("local_nombre"),
                        "visitante": match.get("visitante_nombre"),
                        "estado": match.get("estado"),
                        "reason": reason,
                    }
                )

    tournaments = Counter(str(match.get("torneo") or "Sin torneo") for match in matches)
    history_by_tournament = Counter(str(match.get("torneo") or "Sin torneo") for match in valid_history)
    teams = _team_match_counts(valid_history)
    min_team_history = min(teams.values()) if teams else 0
    low_history_teams = [team for team, count in teams.items() if count < 5][:20]
    tournament_warnings = [
        f"{name}: solo {count} historicos validos"
        for name, count in sorted(history_by_tournament.items())
        if count < 20
    ]
    warnings: list[str] = []

    if len(valid_history) < min_history:
        warnings.append(f"Historicos insuficientes: {len(valid_history)} de {min_history} requeridos.")
    if low_history_teams:
        warnings.append(f"Equipos con pocos historicos: {', '.join(low_history_teams[:8])}.")
    if tournament_warnings:
        warnings.extend(tournament_warnings[:8])
    if not warnings:
        warnings.append("Datos suficientes para ejecutar el modelo; valida metricas antes de confiar en V2.")

    return {
        "model_version": model_version,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_partidos_disponibles": len(matches),
        "total_partidos_finalizados": sum(1 for match in matches if match.get("estado") == "finalizado"),
        "partidos_con_resultado_valido": len(valid_history),
        "rango_fechas_historicos": _safe_date_range(valid_history),
        "torneos_disponibles": sorted(tournaments.keys()),
        "equipos_disponibles": sorted({name for match in valid_history for name in [match.get("local_nombre"), match.get("visitante_nombre")] if name}),
        "partidos_por_torneo": dict(sorted(tournaments.items())),
        "historicos_por_torneo": dict(sorted(history_by_tournament.items())),
        "partidos_descartados": {
            "total": sum(discarded_counter.values()),
            "por_motivo": dict(sorted(discarded_counter.items())),
            "ejemplos": discarded_examples,
        },
        "cantidad_minima_historicos_por_equipo": min_team_history,
        "equipos_con_pocos_historicos": low_history_teams,
        "predicciones_guardadas": len(predictions),
        "predicciones_por_modelo": dict(Counter(str(row.get("model_version") or "sin_version") for row in predictions)),
        "suficiente_para_predicciones_confiables": len(valid_history) >= min_history and min_team_history >= 3,
        "advertencias": warnings,
    }


def summarize_for_console(diagnostics: dict[str, Any]) -> str:
    lines = [
        f"Modelo: {diagnostics['model_version']}",
        f"Total partidos disponibles: {diagnostics['total_partidos_disponibles']}",
        f"Total finalizados: {diagnostics['total_partidos_finalizados']}",
        f"Resultado valido: {diagnostics['partidos_con_resultado_valido']}",
        f"Rango historicos: {diagnostics['rango_fechas_historicos']['desde']} a {diagnostics['rango_fechas_historicos']['hasta']}",
        f"Torneos: {len(diagnostics['torneos_disponibles'])}",
        f"Equipos: {len(diagnostics['equipos_disponibles'])}",
        f"Minimo historicos por equipo: {diagnostics['cantidad_minima_historicos_por_equipo']}",
        f"Predicciones guardadas: {diagnostics['predicciones_guardadas']}",
        "Advertencias:",
    ]
    lines.extend(f"- {warning}" for warning in diagnostics["advertencias"])
    return "\n".join(lines)

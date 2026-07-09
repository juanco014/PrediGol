from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .poisson_elo import parse_date


@dataclass(frozen=True)
class DataQualityThresholds:
    min_finished_matches: int = 100
    min_matches_per_tournament: int = 30
    min_matches_per_team: int = 8
    min_temporal_days: int = 90
    min_evaluated_matches: int = 30


def _date_range(matches: list[dict[str, Any]]) -> tuple[datetime | None, datetime | None]:
    dates = []
    for match in matches:
        try:
            dates.append(parse_date(match.get("fecha_orden")))
        except Exception:
            continue
    return (min(dates), max(dates)) if dates else (None, None)


def finished_with_score(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        match
        for match in matches
        if match.get("estado") == "finalizado"
        and match.get("goles_local_final") is not None
        and match.get("goles_visitante_final") is not None
    ]


def build_data_quality_report(
    matches: list[dict[str, Any]],
    pending_aliases: int = 0,
    discarded_matches: int = 0,
    thresholds: DataQualityThresholds | None = None,
    evaluated_matches: int | None = None,
    same_evaluation_set: bool | None = None,
) -> dict[str, Any]:
    thresholds = thresholds or DataQualityThresholds()
    history = finished_with_score(matches)
    by_tournament = Counter(str(match.get("torneo") or "Sin torneo") for match in history)
    by_home = Counter(str(match.get("local_nombre") or "Sin local") for match in history)
    by_away = Counter(str(match.get("visitante_nombre") or "Sin visitante") for match in history)
    by_team = by_home + by_away
    start, end = _date_range(history)
    temporal_days = (end - start).days if start and end else 0
    low_tournaments = {name: count for name, count in by_tournament.items() if count < thresholds.min_matches_per_tournament}
    low_teams = {name: count for name, count in by_team.items() if count < thresholds.min_matches_per_team}
    warnings: list[str] = []

    if len(history) < thresholds.min_finished_matches:
        warnings.append(
            f"Muestra pequena: {len(history)} partidos finalizados con marcador; minimo operativo {thresholds.min_finished_matches}."
        )
    if temporal_days < thresholds.min_temporal_days:
        warnings.append(
            f"Rango temporal corto: {temporal_days} dias; minimo operativo {thresholds.min_temporal_days}."
        )
    if low_tournaments:
        warnings.append(f"Torneos con historial insuficiente: {len(low_tournaments)}.")
    if low_teams:
        warnings.append(f"Equipos con historial insuficiente: {len(low_teams)}.")
    if pending_aliases:
        warnings.append(f"Aliases pendientes de revision: {pending_aliases}.")
    if discarded_matches:
        warnings.append(f"Partidos descartados antes de evaluar: {discarded_matches}.")
    if evaluated_matches is not None and evaluated_matches < thresholds.min_evaluated_matches:
        warnings.append(
            f"Backtest preliminar: {evaluated_matches} partidos evaluados; minimo operativo {thresholds.min_evaluated_matches}."
        )
    if same_evaluation_set is False:
        warnings.append("Comparacion no valida: V1 y V2 no evaluaron exactamente el mismo conjunto de partidos.")

    return {
        "thresholds": thresholds.__dict__,
        "finished_matches": len(history),
        "matches_by_tournament": dict(sorted(by_tournament.items())),
        "matches_by_team": dict(sorted(by_team.items())),
        "home_matches_by_team": dict(sorted(by_home.items())),
        "away_matches_by_team": dict(sorted(by_away.items())),
        "date_from": start.isoformat() if start else None,
        "date_to": end.isoformat() if end else None,
        "temporal_days": temporal_days,
        "low_history_tournaments": dict(sorted(low_tournaments.items())),
        "low_history_teams": dict(sorted(low_teams.items())),
        "pending_aliases": pending_aliases,
        "discarded_matches": discarded_matches,
        "evaluated_matches": evaluated_matches,
        "same_evaluation_set": same_evaluation_set,
        "preliminary": bool(warnings),
        "warnings": warnings,
    }


def validate_imported_dataset(matches: list[dict[str, Any]], expected_season: int | None = None) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    seen_external: set[str] = set()
    seen_fallback: set[tuple[str, str, str, str, str]] = set()
    seasons: set[int] = set()

    for index, match in enumerate(matches, start=1):
        home = match.get("local_nombre")
        away = match.get("visitante_nombre")
        if not home or not away:
            errors.append(f"Fila {index}: equipo local o visitante faltante.")
        if home and away and str(home).casefold() == str(away).casefold():
            errors.append(f"Fila {index}: local y visitante iguales.")

        try:
            parsed_date = parse_date(match.get("fecha_orden"))
        except Exception:
            errors.append(f"Fila {index}: fecha invalida.")
            parsed_date = None

        if match.get("estado") == "finalizado" and (
            match.get("goles_local_final") is None or match.get("goles_visitante_final") is None
        ):
            errors.append(f"Fila {index}: partido finalizado sin marcador.")

        season = match.get("temporada")
        if season is not None:
            try:
                seasons.add(int(season))
            except ValueError:
                errors.append(f"Fila {index}: temporada invalida.")

        external_id = str(match.get("api_football_fixture_id") or match.get("payload_api", {}).get("internal_match", {}).get("external_match_id") or "")
        if external_id:
            if external_id in seen_external:
                errors.append(f"Fila {index}: external_match_id duplicado ({external_id}).")
            seen_external.add(external_id)

        if parsed_date and home and away:
            fallback = (
                str(match.get("torneo") or ""),
                str(match.get("temporada") or ""),
                parsed_date.isoformat(),
                str(home).casefold(),
                str(away).casefold(),
            )
            if fallback in seen_fallback:
                errors.append(f"Fila {index}: duplicado por liga/temporada/fecha/equipos.")
            seen_fallback.add(fallback)

        normalization = match.get("payload_api", {}).get("team_normalization", {})
        if any((normalization.get(side) or {}).get("status") == "pending_review" for side in ["home", "away"]):
            warnings.append(f"Fila {index}: alias de equipo pendiente de revision.")

    if expected_season is not None and seasons and seasons != {expected_season}:
        errors.append(f"Temporadas mezcladas: esperado {expected_season}, observado {sorted(seasons)}.")
    if len(seasons) > 1:
        errors.append(f"Dataset mezcla temporadas: {sorted(seasons)}.")

    return {
        "status": "valid" if not errors else "invalid",
        "valid_for_training": not errors,
        "errors": errors,
        "warnings": warnings,
        "matches": len(matches),
        "finished_matches": len(finished_with_score(matches)),
        "seasons": sorted(seasons),
    }

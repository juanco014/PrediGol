from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))
sys.path.insert(0, str(ROOT))

from predigol_model.data_quality import validate_imported_dataset
from predigol_model.external_football_api import create_external_football_api

from scripts.importar_temporada import display_path, write_import_reports
from scripts.importar_temporada_api import summarize_import, write_dataset_file


REPORTS = ROOT / "reports"
DEFAULT_LEAGUES = {
    "premier-league": "39",
    "laliga": "140",
    "serie-a": "135",
    "bundesliga": "78",
    "ligue-1": "61",
}
DEFAULT_SEASONS = [2022, 2023, 2024]


@dataclass(frozen=True)
class LeagueTarget:
    name: str
    league_id: str


def dataset_path(output_dir: Path, provider: str, league_id: str, season: int) -> Path:
    return output_dir / f"api_{provider}_liga-{league_id}_temporada-{season}_dataset.json"


def report_base(output_dir: Path, provider: str, league_id: str, season: int) -> Path:
    return output_dir / f"api_{provider}_liga-{league_id}_temporada-{season}"


def parse_seasons(value: str | None) -> list[int]:
    if not value:
        return list(DEFAULT_SEASONS)
    seasons = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not seasons:
        raise ValueError("Debes indicar al menos una temporada.")
    return seasons


def parse_leagues(values: list[str] | None) -> list[LeagueTarget]:
    if not values:
        return [LeagueTarget(name, league_id) for name, league_id in DEFAULT_LEAGUES.items()]
    targets = []
    for value in values:
        for item in value.split(","):
            raw = item.strip()
            if not raw:
                continue
            if ":" in raw:
                name, league_id = raw.split(":", 1)
            else:
                name, league_id = raw, raw
            league_id = league_id.strip()
            if not league_id.isdigit():
                raise ValueError(f"ID de liga invalido: {raw}")
            targets.append(LeagueTarget(name.strip() or league_id, league_id))
    if not targets:
        raise ValueError("Debes indicar al menos una liga.")
    return targets


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Importar multiples ligas y temporadas desde API-Football a reports/.")
    parser.add_argument(
        "--league",
        action="append",
        help="Liga como nombre:id o id. Se puede repetir o separar por comas. Default: top 5 ligas europeas.",
    )
    parser.add_argument("--seasons", default=",".join(str(season) for season in DEFAULT_SEASONS), help="Temporadas separadas por coma.")
    parser.add_argument("--provider", default="api_football")
    parser.add_argument("--output", default=str(REPORTS), help="Directorio de salida para datasets y reportes.")
    parser.add_argument("--include-upcoming", action="store_true", help="Incluye partidos pendientes en el dataset local.")
    parser.add_argument("--force", action="store_true", help="Vuelve a descargar aunque el dataset ya exista.")
    parser.add_argument("--dry-run", action="store_true", help="Muestra el plan y valida argumentos sin consultar la API.")
    return parser


def import_one(api: Any, target: LeagueTarget, season: int, output_dir: Path, include_upcoming: bool) -> dict[str, Any]:
    result, fetched = api.importer.import_season(target.league_id, season, include_upcoming=include_upcoming)
    quality = validate_imported_dataset(result.valid, expected_season=season)
    base = report_base(output_dir, api.provider, target.league_id, season)
    duplicates = {"api_football_fixture_id": set(), "fallback": set()}
    report_paths = write_import_reports(result, base, duplicates)
    path = write_dataset_file(result, api.provider, target.league_id, season, quality, base)
    summary = summarize_import(result, fetched, quality, duplicates, api.provider, target.league_id, season, report_paths, path, None)
    summary.update(
        {
            "league_name": target.name,
            "status": "imported",
            "discarded_matches": summary["omitted_matches"] + summary["duplicates_in_payload"],
        }
    )
    return summary


def run_imports(
    leagues: list[LeagueTarget],
    seasons: list[int],
    provider: str,
    output_dir: Path,
    include_upcoming: bool = False,
    force: bool = False,
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    output_dir.mkdir(exist_ok=True)
    summaries: list[dict[str, Any]] = []
    pending = []
    for target in leagues:
        for season in seasons:
            path = dataset_path(output_dir, "api_football", target.league_id, season)
            if path.exists() and not force:
                summaries.append(
                    {
                        "status": "skipped_existing",
                        "league_name": target.name,
                        "league_id": target.league_id,
                        "season": season,
                        "matches_found": None,
                        "finished_matches": None,
                        "discarded_matches": None,
                        "dataset_file": display_path(path),
                    }
                )
                continue
            pending.append((target, season))

    if dry_run:
        summaries.extend(
            {
                "status": "planned",
                "league_name": target.name,
                "league_id": target.league_id,
                "season": season,
                "dataset_file": display_path(dataset_path(output_dir, "api_football", target.league_id, season)),
            }
            for target, season in pending
        )
        return summaries

    if not pending:
        return summaries

    api = create_external_football_api(provider=provider, dry_run=False)
    for target, season in pending:
        try:
            summaries.append(import_one(api, target, season, output_dir, include_upcoming))
        except Exception as error:  # noqa: BLE001
            summaries.append(
                {
                    "status": "error",
                    "league_name": target.name,
                    "league_id": target.league_id,
                    "season": season,
                    "error": str(error),
                    "dataset_file": display_path(dataset_path(output_dir, api.provider, target.league_id, season)),
                }
            )
    return summaries


def print_table(summaries: list[dict[str, Any]]) -> None:
    print("liga\ttemporada\testado\tdescargados\tfinalizados\tdescartados\tdataset")
    for item in summaries:
        print(
            "\t".join(
                str(value if value is not None else "")
                for value in [
                    item.get("league_name") or item.get("league_id"),
                    item.get("season"),
                    item.get("status"),
                    item.get("matches_found"),
                    item.get("finished_matches"),
                    item.get("discarded_matches"),
                    item.get("dataset_file"),
                ]
            )
        )


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        leagues = parse_leagues(args.league)
        seasons = parse_seasons(args.seasons)
    except ValueError as error:
        parser.error(str(error))

    try:
        summaries = run_imports(
            leagues,
            seasons,
            provider=args.provider,
            output_dir=Path(args.output),
            include_upcoming=args.include_upcoming,
            force=args.force,
            dry_run=args.dry_run,
        )
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 1

    print_table(summaries)
    print(json.dumps({"summary": summaries}, ensure_ascii=False, indent=2))
    return 1 if any(item.get("status") == "error" for item in summaries) else 0


if __name__ == "__main__":
    raise SystemExit(main())

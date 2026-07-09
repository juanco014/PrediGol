from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))
REPORTS = ROOT / "reports"

from predigol_model.config import load_settings
from predigol_model.importers import load_and_validate
from predigol_model.supabase_client import SupabaseRestClient
from predigol_model.team_normalization import TeamNormalizer
from predigol_model.traceability import build_dataset_metadata, build_run_payload, insert_dataset, insert_model_run


def fetch_normalizer(client: SupabaseRestClient) -> TeamNormalizer:
    try:
        rows = client.select(
            "team_aliases",
            {
                "select": "canonical_name,alias,tournament,country,active,status,confidence,source,notes",
                "active": "eq.true",
                "limit": "5000",
            },
        )
        return TeamNormalizer.from_supabase_rows(rows)
    except Exception:
        return TeamNormalizer()


def existing_fixture_ids(client: SupabaseRestClient, rows: list[dict[str, object]]) -> set[int]:
    fixture_ids = sorted({int(row["api_football_fixture_id"]) for row in rows if row.get("api_football_fixture_id") is not None})
    if not fixture_ids:
        return set()
    existing = client.select(
        "partidos",
        {
            "select": "api_football_fixture_id",
            "api_football_fixture_id": f"in.({','.join(str(item) for item in fixture_ids)})",
            "limit": str(len(fixture_ids)),
        },
    )
    return {int(row["api_football_fixture_id"]) for row in existing if row.get("api_football_fixture_id") is not None}


def existing_fallback_keys(client: SupabaseRestClient, rows: list[dict[str, object]]) -> set[str]:
    fallback_keys = sorted({
        str(row.get("payload_api", {}).get("fallback_identity", {}).get("key"))
        for row in rows
        if row.get("payload_api", {}).get("fallback_identity", {}).get("key")
    })
    if not fallback_keys:
        return set()
    existing = client.select(
        "partidos",
        {
            "select": "payload_api",
            "payload_api->fallback_identity->>key": f"in.({','.join(fallback_keys)})",
            "limit": str(len(fallback_keys)),
        },
    )
    return {
        str(row.get("payload_api", {}).get("fallback_identity", {}).get("key"))
        for row in existing
        if row.get("payload_api", {}).get("fallback_identity", {}).get("key")
    }


def existing_duplicates(client: SupabaseRestClient, rows: list[dict[str, object]]) -> dict[str, set[object]]:
    return {
        "api_football_fixture_id": existing_fixture_ids(client, rows),
        "fallback": existing_fallback_keys(client, rows),
    }


def write_import_reports(result, report_base: Path, duplicates_against_supabase: dict[str, set[object]] | None = None) -> dict[str, Path]:
    duplicates_against_supabase = duplicates_against_supabase or {"api_football_fixture_id": set(), "fallback": set()}
    duplicate_fixture_ids = duplicates_against_supabase.get("api_football_fixture_id", set())
    duplicate_fallback_keys = duplicates_against_supabase.get("fallback", set())
    json_path = report_base.with_suffix(".json")
    csv_path = report_base.with_suffix(".csv")
    summary = result.summary()
    valid_dates = sorted(row.get("fecha_orden") for row in result.valid if row.get("fecha_orden"))
    teams = sorted({name for row in result.valid for name in [row.get("local_nombre"), row.get("visitante_nombre")] if name})
    identity_types = Counter(row.get("payload_api", {}).get("import_identity", {}).get("type", "unknown") for row in result.valid)
    summary["duplicates_against_supabase"] = {
        "by_identifier": len(duplicate_fixture_ids),
        "by_fallback": len(duplicate_fallback_keys),
    }
    summary["requires_alias_review"] = bool(result.pending)
    summary["tournaments"] = sorted({row.get("torneo") for row in result.valid if row.get("torneo")})
    summary["date_range"] = {"from": valid_dates[0] if valid_dates else None, "to": valid_dates[-1] if valid_dates else None}
    summary["teams"] = teams
    summary["identity_types"] = dict(sorted(identity_types.items()))
    summary["quality_warnings"] = []
    if result.pending:
        summary["quality_warnings"].append("Hay aliases pendientes o ambiguos; revisalos antes de usar metricas definitivas.")
    if result.discarded:
        summary["quality_warnings"].append("Hay filas descartadas; revisa motivos por fila.")
    if result.duplicates:
        summary["quality_warnings"].append("Hay duplicados dentro del archivo.")
    if duplicate_fixture_ids or duplicate_fallback_keys:
        summary["quality_warnings"].append("Hay partidos que ya existen en Supabase y seran omitidos en --confirm.")
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    fieldnames = ["status", "row", "reason", "fecha", "torneo", "temporada", "local", "visitante", "goles_local", "goles_visitante", "fixture_id"]
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in result.valid:
            fixture_id = row.get("api_football_fixture_id")
            fallback_key = row.get("payload_api", {}).get("fallback_identity", {}).get("key")
            duplicate_reason = ""
            if fixture_id in duplicate_fixture_ids:
                duplicate_reason = "ya existe en Supabase por identificador"
            elif fallback_key in duplicate_fallback_keys:
                duplicate_reason = "ya existe en Supabase por fallback"
            writer.writerow({
                "status": "duplicate_supabase" if duplicate_reason else "valid",
                "row": "",
                "reason": duplicate_reason,
                "fecha": row.get("fecha_orden"),
                "torneo": row.get("torneo"),
                "temporada": row.get("temporada"),
                "local": row.get("payload_api", {}).get("raw", {}).get("local", row.get("local_nombre")),
                "visitante": row.get("payload_api", {}).get("raw", {}).get("visitante", row.get("visitante_nombre")),
                "goles_local": row.get("goles_local_final"),
                "goles_visitante": row.get("goles_visitante_final"),
                "fixture_id": fixture_id,
            })
        for label, issues in [("discarded", result.discarded), ("pending_alias", result.pending), ("duplicate_file", result.duplicates)]:
            for issue in issues:
                writer.writerow({
                    "status": label,
                    "row": issue.row,
                    "reason": issue.reason,
                    "fecha": issue.data.get("fecha"),
                    "torneo": issue.data.get("torneo"),
                    "temporada": issue.data.get("temporada"),
                    "local": issue.data.get("local"),
                    "visitante": issue.data.get("visitante"),
                    "goles_local": issue.data.get("goles_local"),
                    "goles_visitante": issue.data.get("goles_visitante"),
                    "fixture_id": issue.data.get("external_id") or issue.data.get("fixture_id"),
                })
    return {"json": json_path, "csv": csv_path}


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def confirm_import(
    client: SupabaseRestClient,
    path: Path,
    dataset_name: str,
    result,
    report_path: Path,
    source_type: str | None = None,
    source_name: str | None = None,
    run_type: str = "import_validation",
    model_config: dict[str, object] | None = None,
) -> dict[str, object]:
    if not result.valid:
        return {"written": [], "dataset": None, "existing_count": 0}

    before_existing = existing_duplicates(client, result.valid)
    existing_ids = before_existing.get("api_football_fixture_id", set())
    existing_fallbacks = before_existing.get("fallback", set())
    rows_to_write = [
        row
        for row in result.valid
        if row.get("api_football_fixture_id") not in existing_ids
        and row.get("payload_api", {}).get("fallback_identity", {}).get("key") not in existing_fallbacks
    ]
    omitted_existing = len(result.valid) - len(rows_to_write)
    written = client.upsert("partidos", rows_to_write, on_conflict="api_football_fixture_id")
    dataset = build_dataset_metadata(
        dataset_name,
        result.valid,
        result.valid,
        [issue.data for issue in result.discarded],
        source_type=source_type or ("csv" if path.suffix.casefold() == ".csv" else "manual"),
        source_name=source_name or str(path),
        status="validated" if not result.pending else "draft",
        description="Dataset creado por scripts/importar_temporada.py",
    )
    dataset_row = insert_dataset(client, dataset)
    insert_model_run(
        client,
        build_run_payload(
            model_version="importer",
            run_type=run_type,
            status="completed",
            available_matches=result.rows,
            used_matches=len(written),
            discarded_matches=len(result.discarded) + len(result.duplicates) + omitted_existing,
            dataset_id=dataset_row.get("id") if dataset_row else None,
            metrics={
                **result.summary(),
                "existing_matches": omitted_existing,
                "existing_by_identifier": len(existing_ids),
                "existing_by_fallback": len(existing_fallbacks),
                "inserted_matches": len(written),
                "omitted_existing_matches": omitted_existing,
            },
            warnings=["Hay alias pendientes de revision."] if result.pending else [],
            model_config={"file": str(path), "confirm": True, **(model_config or {})},
            admin_notes=f"Reporte: {display_path(report_path)}",
        ),
    )
    return {"written": written, "dataset": dataset_row, "existing_count": omitted_existing}


def main() -> int:
    parser = argparse.ArgumentParser(description="Importar temporada desde CSV o JSON.")
    parser.add_argument("file", help="Ruta del archivo CSV o JSON")
    parser.add_argument("--confirm", action="store_true", help="Escribe partidos en Supabase. Sin esto es dry-run.")
    parser.add_argument("--dataset-name", default="Importacion de temporada")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        raise FileNotFoundError(path)

    client = None
    normalizer = TeamNormalizer()
    if args.confirm:
        settings = load_settings()
        client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
        normalizer = fetch_normalizer(client)
    else:
        try:
            settings = load_settings()
            client = SupabaseRestClient(settings.supabase_url, settings.supabase_service_role_key)
            normalizer = fetch_normalizer(client)
        except Exception:
            normalizer = TeamNormalizer()

    result = load_and_validate(path, normalizer)
    REPORTS.mkdir(exist_ok=True)
    duplicates_against_supabase = {"api_football_fixture_id": set(), "fallback": set()}
    if client is not None and result.valid:
        try:
            duplicates_against_supabase = existing_duplicates(client, result.valid)
        except Exception:
            duplicates_against_supabase = {"api_football_fixture_id": set(), "fallback": set()}
    report_paths = write_import_reports(result, REPORTS / f"import_{path.stem}", duplicates_against_supabase)
    report_path = report_paths["json"]

    dataset_row = None
    if args.confirm and result.valid:
        if client is None:
            raise RuntimeError("Supabase es obligatorio para confirmar importacion.")
        confirmation = confirm_import(client, path, args.dataset_name, result, report_path)
        written = confirmation["written"]
        dataset_row = confirmation["dataset"]
        print(f"Importacion confirmada: {len(written)} partidos escritos o actualizados.")
        print(f"Partidos ya existentes antes de importar: {confirmation['existing_count']}")
    else:
        print("Dry-run: no se escribio en Supabase.")

    print(json.dumps(result.summary(), ensure_ascii=False, indent=2))
    if result.pending:
        print("ADVERTENCIA: hay aliases pendientes o ambiguos; revisalos antes de considerar metricas definitivas.")
    print(f"Reporte JSON: {display_path(report_paths['json'])}")
    print(f"Reporte CSV: {display_path(report_paths['csv'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

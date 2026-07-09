from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
sys.path.insert(0, str(ROOT / "prediction-service"))


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def dataset_files(reports_dir: Path = REPORTS) -> list[Path]:
    if not reports_dir.exists():
        return []
    return sorted(reports_dir.glob("*_dataset.json"))


def summarize_dataset(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    matches = data.get("matches", []) if isinstance(data, dict) else data
    if not isinstance(matches, list):
        matches = []
    dates = sorted(str(match.get("fecha_orden") or match.get("match_date")) for match in matches if match.get("fecha_orden") or match.get("match_date"))
    finished = [match for match in matches if match.get("estado") == "finalizado" or match.get("status") == "finalizado"]
    quality = data.get("quality", {}) if isinstance(data, dict) else {}
    return {
        "file": display_path(path),
        "name": data.get("name") if isinstance(data, dict) else path.stem,
        "provider": data.get("provider") if isinstance(data, dict) else None,
        "league_id": data.get("league_id") if isinstance(data, dict) else None,
        "season": data.get("season") if isinstance(data, dict) else None,
        "total_matches": len(matches),
        "finished_matches": len(finished),
        "date_from": dates[0] if dates else None,
        "date_to": dates[-1] if dates else None,
        "quality_status": quality.get("status") or data.get("status") if isinstance(data, dict) else None,
        "valid_for_training": quality.get("valid_for_training") if isinstance(quality, dict) else None,
        "checksum": data.get("checksum") if isinstance(data, dict) else None,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Listar datasets locales generados en reports/.")
    parser.add_argument("--reports-dir", default=str(REPORTS))
    parser.add_argument("--json", action="store_true", help="Imprime salida JSON en vez de tabla.")
    args = parser.parse_args(argv)

    summaries = [summarize_dataset(path) for path in dataset_files(Path(args.reports_dir))]
    if args.json:
        print(json.dumps(summaries, ensure_ascii=False, indent=2))
        return 0
    if not summaries:
        print("No se encontraron datasets locales (*_dataset.json).")
        return 0
    headers = ["file", "provider", "league_id", "season", "total", "finished", "date_from", "date_to", "quality", "checksum"]
    print("\t".join(headers))
    for item in summaries:
        print(
            "\t".join(
                str(value or "")
                for value in [
                    item["file"],
                    item["provider"],
                    item["league_id"],
                    item["season"],
                    item["total_matches"],
                    item["finished_matches"],
                    item["date_from"],
                    item["date_to"],
                    item["quality_status"],
                    item["checksum"],
                ]
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

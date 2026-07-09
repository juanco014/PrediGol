from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "prediction-service"))

from predigol_model.preflight import build_preflight, format_preflight


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight de modelos e importacion API.")
    parser.add_argument("--liga")
    parser.add_argument("--temporada")
    args = parser.parse_args()
    items, conclusion = build_preflight(ROOT, league=args.liga, season=args.temporada)
    print(format_preflight(items, conclusion))
    return 1 if any(item.status == "BLOQUEADO" for item in items) else 0


if __name__ == "__main__":
    raise SystemExit(main())

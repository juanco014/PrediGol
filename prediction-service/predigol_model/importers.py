from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from .team_normalization import TeamNormalizer, normalize_team_key
from .traceability import stable_checksum

REQUIRED_COLUMNS = {
    "fecha",
    "torneo",
    "temporada",
    "local",
    "visitante",
    "goles_local",
    "goles_visitante",
    "estado",
}

SUPPORTED_HISTORICAL_STATES = {"finalizado"}


@dataclass
class ImportIssue:
    row: int
    reason: str
    data: dict[str, Any]


@dataclass
class ImportResult:
    source: str
    rows: int = 0
    valid: list[dict[str, Any]] = field(default_factory=list)
    discarded: list[ImportIssue] = field(default_factory=list)
    pending: list[ImportIssue] = field(default_factory=list)
    duplicates: list[ImportIssue] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "rows": self.rows,
            "valid": len(self.valid),
            "discarded": len(self.discarded),
            "pending": len(self.pending),
            "duplicates": len(self.duplicates),
            "discarded_examples": [issue.__dict__ for issue in self.discarded[:10]],
            "pending_examples": [issue.__dict__ for issue in self.pending[:10]],
            "duplicate_examples": [issue.__dict__ for issue in self.duplicates[:10]],
        }


class SeasonImporter(Protocol):
    def read(self, path: Path) -> list[dict[str, Any]]:
        ...


class CsvSeasonImporter:
    def read(self, path: Path) -> list[dict[str, Any]]:
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            return list(csv.DictReader(file))


class JsonSeasonImporter:
    def read(self, path: Path) -> list[dict[str, Any]]:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("matches", [])
        if not isinstance(data, list):
            raise ValueError("El JSON debe ser una lista o un objeto con clave matches.")
        return [dict(item) for item in data]


class ApiImporterPlaceholder:
    def read(self, path: Path) -> list[dict[str, Any]]:
        raise NotImplementedError("La importacion por API queda preparada, pero no conectada a proveedores pagos.")


def importer_for_path(path: Path) -> SeasonImporter:
    suffix = path.suffix.casefold()
    if suffix == ".csv":
        return CsvSeasonImporter()
    if suffix == ".json":
        return JsonSeasonImporter()
    if suffix in {".xlsx", ".xls"}:
        raise NotImplementedError("Excel requiere una dependencia adicional; usa CSV o JSON por ahora.")
    raise ValueError(f"Formato no soportado: {suffix}")


def parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    number = int(value)
    if number < 0:
        raise ValueError("goles negativos")
    return number


def parse_date(value: Any) -> str:
    if not value:
        raise ValueError("fecha vacia")
    text = str(value).strip()
    try:
        date = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        date = datetime.strptime(text, "%Y-%m-%d %H:%M")
        date = date.replace(tzinfo=timezone.utc)
    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    return date.isoformat()


def normalize_identity_text(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def build_fallback_identity(
    fecha: str,
    torneo: str,
    temporada: int,
    home_key: str,
    away_key: str,
    ronda: Any = None,
) -> dict[str, Any]:
    payload = {
        "fecha": fecha,
        "torneo": normalize_identity_text(torneo),
        "temporada": temporada,
        "local": normalize_team_key(home_key),
        "visitante": normalize_team_key(away_key),
        "ronda": normalize_identity_text(ronda),
    }
    return {"type": "fallback", "key": stable_checksum(payload), "payload": payload}


def build_import_identity(lower: dict[str, Any], normalized: dict[str, Any], home_key: str, away_key: str) -> dict[str, Any]:
    external_id = lower.get("external_id")
    api_football_id = lower.get("api_football_fixture_id") or lower.get("fixture_id")
    if external_id and str(external_id).strip():
        return {"type": "external_id", "key": normalize_identity_text(external_id), "payload": {"external_id": str(external_id).strip()}}
    if api_football_id and str(api_football_id).strip():
        return {"type": "api_football_fixture_id", "key": normalize_identity_text(api_football_id), "payload": {"api_football_fixture_id": str(api_football_id).strip()}}
    return build_fallback_identity(
        str(normalized["fecha_orden"]),
        str(normalized["torneo"]),
        int(normalized["temporada"]),
        home_key,
        away_key,
        normalized.get("ronda"),
    )


def stable_fixture_id(row: dict[str, Any]) -> int:
    identity = row.get("payload_api", {}).get("import_identity", {})
    raw = stable_checksum(identity or row)
    return -int(raw[:12], 16)


def validate_and_normalize_rows(rows: list[dict[str, Any]], source: str, normalizer: TeamNormalizer | None = None, allow_non_finished: bool = False) -> ImportResult:
    normalizer = normalizer or TeamNormalizer()
    result = ImportResult(source=source, rows=len(rows))
    seen_identities: dict[tuple[str, str], int] = {}
    seen_fallbacks: dict[str, int] = {}

    for index, raw in enumerate(rows, start=2):
        lower = {str(key).strip().casefold(): value for key, value in raw.items()}
        required_columns = REQUIRED_COLUMNS if not allow_non_finished else REQUIRED_COLUMNS - {"goles_local", "goles_visitante"}
        missing = [column for column in required_columns if not lower.get(column)]
        if missing:
            result.discarded.append(ImportIssue(index, f"columnas requeridas faltantes: {', '.join(missing)}", raw))
            continue

        try:
            fecha = parse_date(lower["fecha"])
            estado = str(lower.get("estado") or "").strip().casefold()
            torneo = str(lower["torneo"]).strip()
            temporada = parse_int(lower.get("temporada"))
            if temporada is None:
                raise ValueError("temporada faltante")
            if estado not in SUPPORTED_HISTORICAL_STATES and not allow_non_finished:
                raise ValueError(f"estado no importable para historico: {estado or 'sin_estado'}")
            home = normalizer.resolve(lower["local"], torneo)
            away = normalizer.resolve(lower["visitante"], torneo)
            if home.status == "invalid" or away.status == "invalid":
                raise ValueError("equipo local o visitante vacio")
            if home.canonical_key == away.canonical_key:
                raise ValueError("local y visitante iguales")
            goles_local = parse_int(lower.get("goles_local"))
            goles_visitante = parse_int(lower.get("goles_visitante"))
            if estado == "finalizado" and (goles_local is None or goles_visitante is None):
                raise ValueError("partido finalizado sin marcador completo")
            if estado != "finalizado":
                goles_local = None
                goles_visitante = None
        except Exception as error:  # noqa: BLE001
            result.discarded.append(ImportIssue(index, str(error), raw))
            continue

        normalized = {
            "torneo": torneo,
            "fecha_texto": fecha,
            "fecha_orden": fecha,
            "local_nombre": home.canonical_name,
            "visitante_nombre": away.canonical_name,
            "local_corto": home.canonical_name[:3].upper(),
            "visitante_corto": away.canonical_name[:3].upper(),
            "estado": estado,
            "goles_local_final": goles_local,
            "goles_visitante_final": goles_visitante,
            "temporada": temporada,
            "ronda": lower.get("jornada") or lower.get("ronda"),
            "origen_datos": "manual",
            "fuente_detalle": source,
            "payload_api": {
                "source": source,
                "raw": raw,
                "team_normalization": {
                    "home": home.__dict__,
                    "away": away.__dict__,
                },
            },
        }
        identity = build_import_identity(lower, normalized, home.canonical_key, away.canonical_key)
        fallback_identity = build_fallback_identity(fecha, torneo, temporada, home.canonical_key, away.canonical_key, normalized.get("ronda"))
        normalized["payload_api"]["import_identity"] = identity
        normalized["payload_api"]["fallback_identity"] = fallback_identity
        if identity["type"] in {"external_id", "api_football_fixture_id"} and str(identity["key"]).lstrip("-").isdigit():
            normalized["api_football_fixture_id"] = int(identity["key"])
        else:
            normalized["api_football_fixture_id"] = stable_fixture_id(normalized)
        normalized["id"] = normalized["api_football_fixture_id"]
        identity_key = (identity["type"], identity["key"])
        if identity_key in seen_identities:
            result.duplicates.append(ImportIssue(index, f"duplicado dentro del archivo por {identity['type']}", raw))
            continue
        fallback_key = str(fallback_identity["key"])
        if fallback_key in seen_fallbacks:
            result.duplicates.append(ImportIssue(index, "duplicado dentro del archivo por fallback", raw))
            continue
        seen_identities[identity_key] = index
        seen_fallbacks[fallback_key] = index
        if home.status == "pending_review" or away.status == "pending_review":
            result.pending.append(ImportIssue(index, "alias pendiente o ambiguo", raw))
        result.valid.append(normalized)
    return result


def load_and_validate(path: Path, normalizer: TeamNormalizer | None = None) -> ImportResult:
    importer = importer_for_path(path)
    return validate_and_normalize_rows(importer.read(path), str(path), normalizer)

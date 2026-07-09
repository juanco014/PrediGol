from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    api_football_key: str = ""
    api_football_base_url: str = "https://v3.football.api-sports.io"
    history_limit: int = 2000
    upcoming_limit: int = 250
    min_history_matches: int = 30


@dataclass(frozen=True)
class FootballApiSettings:
    provider: str = "api_football"
    api_key: str = ""
    base_url: str = "https://v3.football.api-sports.io"
    timeout_seconds: float = 20.0
    max_retries: int = 3
    rate_limit_sleep_seconds: float = 1.0
    dry_run: bool = True


def load_settings() -> Settings:
    load_env_file(Path(__file__).resolve().parents[1] / ".env")

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url:
        raise RuntimeError("Missing SUPABASE_URL")

    if not service_role_key:
        raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

    return Settings(
        supabase_url=supabase_url,
        supabase_service_role_key=service_role_key,
        api_football_key=os.environ.get("API_FOOTBALL_KEY", ""),
        api_football_base_url=os.environ.get("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io").rstrip("/"),
        history_limit=int(os.environ.get("PREDIGOL_HISTORY_LIMIT", "2000")),
        upcoming_limit=int(os.environ.get("PREDIGOL_UPCOMING_LIMIT", "250")),
        min_history_matches=int(os.environ.get("PREDIGOL_MIN_HISTORY_MATCHES", "30")),
    )


def load_api_football_settings() -> tuple[str, str]:
    load_env_file(Path(__file__).resolve().parents[1] / ".env")
    api_key = os.environ.get("FOOTBALL_API_KEY", os.environ.get("API_FOOTBALL_KEY", "")).strip()
    base_url = os.environ.get("FOOTBALL_API_BASE_URL", os.environ.get("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io")).strip().rstrip("/")
    if not api_key:
        raise RuntimeError("Missing FOOTBALL_API_KEY")
    return api_key, base_url


def load_football_api_settings(provider: str | None = None, dry_run: bool | None = None) -> FootballApiSettings:
    load_env_file(Path(__file__).resolve().parents[1] / ".env")
    selected_provider = (provider or os.environ.get("FOOTBALL_API_PROVIDER") or "api_football").strip()
    api_key = os.environ.get("FOOTBALL_API_KEY", os.environ.get("API_FOOTBALL_KEY", "")).strip()
    base_url = os.environ.get("FOOTBALL_API_BASE_URL", os.environ.get("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io")).strip().rstrip("/")
    return FootballApiSettings(
        provider=selected_provider,
        api_key=api_key,
        base_url=base_url,
        timeout_seconds=float(os.environ.get("FOOTBALL_API_TIMEOUT_SECONDS", "20")),
        max_retries=int(os.environ.get("FOOTBALL_API_MAX_RETRIES", "3")),
        rate_limit_sleep_seconds=float(os.environ.get("FOOTBALL_API_RATE_LIMIT_SLEEP_SECONDS", "1")),
        dry_run=(os.environ.get("FOOTBALL_API_DRY_RUN", "true").casefold() == "true") if dry_run is None else dry_run,
    )

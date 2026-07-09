from __future__ import annotations

from typing import Any

import httpx


class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = f"{url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = httpx.get(
            f"{self.base_url}/{table}",
            params=params,
            headers=self.headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def count(self, table: str, params: dict[str, str] | None = None) -> int | None:
        headers = {
            **self.headers,
            "Prefer": "count=exact",
        }
        response = httpx.get(
            f"{self.base_url}/{table}",
            params={"select": "*", "limit": "0", **(params or {})},
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        content_range = response.headers.get("content-range", "")
        if "/" not in content_range:
            return None
        total = content_range.rsplit("/", 1)[-1]
        return int(total) if total.isdigit() else None

    def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        on_conflict: str,
    ) -> list[dict[str, Any]]:
        if not rows:
            return []

        headers = {
            **self.headers,
            "Prefer": "resolution=merge-duplicates,return=representation",
        }

        response = httpx.post(
            f"{self.base_url}/{table}",
            params={"on_conflict": on_conflict},
            headers=headers,
            json=rows,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        headers = {
            **self.headers,
            "Prefer": "return=representation",
        }

        response = httpx.post(
            f"{self.base_url}/{table}",
            headers=headers,
            json=row,
            timeout=60,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else row

    def rpc(self, function_name: str, payload: dict[str, Any] | None = None) -> Any:
        response = httpx.post(
            f"{self.base_url}/rpc/{function_name}",
            headers=self.headers,
            json=payload or {},
            timeout=30,
        )
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

from __future__ import annotations

import io
import unittest
from contextlib import redirect_stdout
from dataclasses import dataclass
from typing import Any

from scripts import publicar_predicciones_v1_mvp as publisher


def history(count: int = 40) -> list[dict[str, Any]]:
    teams = ["Equipo A", "Equipo B", "Equipo C", "Equipo D"]
    rows = []
    for index in range(count):
        home = teams[index % len(teams)]
        away = teams[(index + 1) % len(teams)]
        rows.append(
            {
                "id": f"h-{index}",
                "api_football_fixture_id": 1000 + index,
                "torneo": "Liga Real",
                "fecha_orden": f"2024-01-{(index % 28) + 1:02d}T00:00:00+00:00",
                "local_nombre": home,
                "visitante_nombre": away,
                "goles_local_final": index % 4,
                "goles_visitante_final": (index + 1) % 3,
                "estado": "finalizado",
            }
        )
    return rows


def upcoming(count: int = 2) -> list[dict[str, Any]]:
    rows = []
    for index in range(count):
        rows.append(
            {
                "id": f"p-{index}",
                "api_football_fixture_id": 9000 + index,
                "torneo": "Liga Real",
                "fecha_orden": f"2026-08-{index + 1:02d}T00:00:00+00:00",
                "local_nombre": "Equipo A",
                "visitante_nombre": "Equipo B",
                "estado": "proximo",
            }
        )
    return rows


@dataclass
class FakeWriter:
    fail_on: str | None = None
    inserted: int = 0
    updated: int = 0

    def insert_prediction(self, row: dict[str, Any]) -> dict[str, Any]:
        if self.fail_on == "insert":
            raise RuntimeError("supabase insert error")
        self.inserted += 1
        return row

    def update_prediction(self, fixture_id: int, row: dict[str, Any]) -> dict[str, Any]:
        if self.fail_on == "update":
            raise RuntimeError("supabase update error")
        self.updated += 1
        return row


class PublicarPrediccionesV1MvpTests(unittest.TestCase):
    def test_publicacion_exclusivamente_v1(self) -> None:
        plan = publisher.build_plan(history(), upcoming(1), {}, limit=1, free_count=1)

        self.assertEqual(plan[0].payload["model_version"], publisher.MODEL_VERSION)

    def test_rechaza_v2(self) -> None:
        payload = {
            "home_win_probability": 0.4,
            "draw_probability": 0.3,
            "away_win_probability": 0.3,
            "model_version": "poisson-elo-form-v2",
        }

        with self.assertRaises(ValueError):
            publisher.validate_probability_payload(payload)

    def test_dry_run_no_escribe(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)
        writer = FakeWriter()

        rendered = publisher.plan_to_dict(plan)

        self.assertEqual(writer.inserted, 0)
        self.assertEqual(len(rendered), 2)

    def test_insercion_valida(self) -> None:
        plan = publisher.build_plan(history(), upcoming(1), {}, limit=1, free_count=1)
        writer = FakeWriter()

        summary = publisher.apply_plan(plan, writer)

        self.assertEqual(summary.inserted, 1)
        self.assertEqual(writer.inserted, 1)

    def test_idempotencia_omite_existente_sin_update(self) -> None:
        existing = {9000: {"api_football_fixture_id": 9000}}
        plan = publisher.build_plan(history(), upcoming(1), existing, limit=1, free_count=1)

        self.assertEqual(plan[0].action, "omit")

    def test_prediccion_duplicada_requiere_update_explicito(self) -> None:
        existing = {9000: {"api_football_fixture_id": 9000}}
        plan = publisher.build_plan(history(), upcoming(1), existing, limit=1, free_count=1, allow_update=True)

        self.assertEqual(plan[0].action, "update")

    def test_probabilidades_invalidas(self) -> None:
        payload = {
            "home_win_probability": 1.2,
            "draw_probability": -0.1,
            "away_win_probability": 0.1,
            "model_version": publisher.MODEL_VERSION,
        }

        with self.assertRaises(ValueError):
            publisher.validate_probability_payload(payload)

    def test_fixture_inexistente_en_partido_se_omite(self) -> None:
        row = upcoming(1)[0]
        row["api_football_fixture_id"] = None
        plan = publisher.build_plan(history(), [row], {}, limit=1, free_count=1)

        self.assertEqual(plan[0].action, "omit")

    def test_limite_maximo_publicacion(self) -> None:
        with self.assertRaises(ValueError):
            publisher.validate_limit(publisher.MAX_LIMIT + 1)

    def test_prediccion_gratis_visible_contractual(self) -> None:
        plan = publisher.build_plan(history(), upcoming(1), {}, limit=1, free_count=1)

        self.assertEqual(plan[0].access_tier, "free")
        self.assertEqual(plan[0].payload["access_tier"], "free")

    def test_prediccion_premium_bloqueable_para_gratis(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)

        premium = plan[1].payload
        self.assertEqual(premium["access_tier"], "premium")
        self.assertIn("premium_preview", premium)
        self.assertNotIn("home_win_probability", premium["premium_preview"])

    def test_prediccion_premium_visible_para_premium_con_payload_completo(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)

        premium = plan[1].payload
        self.assertIsNotNone(premium["home_win_probability"])
        self.assertIsNotNone(premium["expected_home_goals"])

    def test_detalle_premium_denegado_para_gratis_por_access_tier(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)

        self.assertEqual(plan[1].payload["access_tier"], "premium")

    def test_detalle_premium_permitido_para_premium_con_modelo_v1(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)

        self.assertEqual(plan[1].payload["model_version"], publisher.MODEL_VERSION)

    def test_secretos_no_impresos_en_plan(self) -> None:
        plan = publisher.build_plan(history(), upcoming(1), {}, limit=1, free_count=1)
        buffer = io.StringIO()

        with redirect_stdout(buffer):
            print(publisher.plan_to_dict(plan))

        output = buffer.getvalue().lower()
        self.assertNotIn("secret", output)
        self.assertNotIn("authorization", output)
        self.assertNotIn("apikey", output)

    def test_error_parcial_supabase_sin_corromper_lote(self) -> None:
        plan = publisher.build_plan(history(), upcoming(2), {}, limit=2, free_count=1)
        writer = FakeWriter(fail_on="insert")

        summary = publisher.apply_plan(plan, writer)

        self.assertEqual(summary.errors, 2)
        self.assertEqual(summary.inserted, 0)


if __name__ == "__main__":
    unittest.main()

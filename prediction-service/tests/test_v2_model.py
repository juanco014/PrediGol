from __future__ import annotations

import unittest

from predigol_model.poisson_elo import PoissonEloModel
from predigol_model.v2 import PoissonEloFormModel, V2Config
from test_evaluation import build_history


class V2ModelTests(unittest.TestCase):
    def test_probabilities_are_valid_and_sum_to_one(self) -> None:
        history = build_history(90)
        model = PoissonEloFormModel(history)
        prediction = model.predict({"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"})
        total = prediction.home_win_probability + prediction.draw_probability + prediction.away_win_probability
        self.assertAlmostEqual(total, 1.0, places=6)
        self.assertTrue(0 <= prediction.confidence <= 1)
        self.assertEqual(prediction.to_payload()["model_version"], "poisson-elo-form-v2")

    def test_calibration_activation_depends_on_history_size(self) -> None:
        small = PoissonEloFormModel(build_history(40))
        large = PoissonEloFormModel(build_history(90))
        self.assertFalse(small.calibration_active)
        self.assertTrue(large.calibration_active)

    def test_invalid_config_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            V2Config(half_life_matches=0)
        with self.assertRaises(ValueError):
            V2Config(dixon_coles_rho=2)
        with self.assertRaises(ValueError):
            V2Config(expected_goals_shrink=0)
        with self.assertRaises(ValueError):
            V2Config(expected_goals_shrink=1.1)

    def test_tournament_fallback_warning_when_few_records(self) -> None:
        model = PoissonEloFormModel(build_history(40))
        prediction = model.predict({"id": 1, "api_football_fixture_id": 1, "torneo": "Torneo nuevo", "local_nombre": "Nuevo A", "visitante_nombre": "Nuevo B"})
        self.assertIn("Torneo con pocos historicos", " ".join(prediction.metadata["warnings"]))

    def test_dixon_coles_can_be_disabled(self) -> None:
        model = PoissonEloFormModel(build_history(90), V2Config(dixon_coles_enabled=False))
        prediction = model.predict({"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"})
        self.assertFalse(prediction.metadata["dixon_coles_enabled"])

    def test_dixon_coles_rho_is_configurable(self) -> None:
        match = {"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"}
        default = PoissonEloFormModel(build_history(90)).predict(match)
        conservative = PoissonEloFormModel(build_history(90), V2Config(dixon_coles_rho=-0.05)).predict(match)

        self.assertEqual(default.metadata["dixon_coles_rho"], -0.2)
        self.assertNotEqual(default.draw_probability, conservative.draw_probability)

    def test_expected_goals_shrink_is_configurable(self) -> None:
        self.assertEqual(V2Config().expected_goals_shrink, 1.0)

        match = {"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"}
        default = PoissonEloFormModel(build_history(90)).predict(match)
        no_shrink = PoissonEloFormModel(build_history(90), V2Config(expected_goals_shrink=1.0)).predict(match)
        experimental_shrink = PoissonEloFormModel(build_history(90), V2Config(expected_goals_shrink=0.90)).predict(match)

        default_total = default.expected_home_goals + default.expected_away_goals
        no_shrink_total = no_shrink.expected_home_goals + no_shrink.expected_away_goals
        experimental_shrink_total = experimental_shrink.expected_home_goals + experimental_shrink.expected_away_goals
        self.assertAlmostEqual(default_total, no_shrink_total, places=12)
        self.assertLess(experimental_shrink_total, no_shrink_total)
        self.assertEqual(experimental_shrink.metadata["expected_goals_shrink"], 0.90)

    def test_expected_goals_shrink_keeps_probabilities_and_score_valid(self) -> None:
        match = {"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"}
        prediction = PoissonEloFormModel(build_history(90), V2Config(expected_goals_shrink=0.80)).predict(match)
        total = prediction.home_win_probability + prediction.draw_probability + prediction.away_win_probability

        self.assertAlmostEqual(total, 1.0, places=6)
        self.assertTrue(0 <= prediction.home_win_probability <= 1)
        self.assertTrue(0 <= prediction.draw_probability <= 1)
        self.assertTrue(0 <= prediction.away_win_probability <= 1)
        self.assertTrue(0 <= prediction.predicted_home_goals <= 8)
        self.assertTrue(0 <= prediction.predicted_away_goals <= 8)
        self.assertTrue(0 <= prediction.metadata["score_probability"] <= 1)

    def test_v1_does_not_use_expected_goals_shrink(self) -> None:
        match = {"id": 999, "api_football_fixture_id": 999, "torneo": "Liga de prueba", "local_nombre": "Equipo 1", "visitante_nombre": "Equipo 2"}
        v1_prediction = PoissonEloModel(build_history(90)).predict(match)

        self.assertNotIn("expected_goals_shrink", v1_prediction.metadata)
        self.assertEqual(v1_prediction.to_payload()["model_version"], "poisson-elo-v1")


if __name__ == "__main__":
    unittest.main()

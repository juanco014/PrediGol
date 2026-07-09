from __future__ import annotations

import unittest

from predigol_model.team_normalization import TeamAlias, TeamNormalizer, normalize_team_key


class TeamNormalizationTests(unittest.TestCase):
    def test_accents_spaces_and_particles_share_key(self) -> None:
        self.assertEqual(normalize_team_key("  América   FC "), normalize_team_key("America"))

    def test_approved_alias_resolves_canonical_team(self) -> None:
        normalizer = TeamNormalizer([TeamAlias("América de Cali", "America", tournament="Liga BetPlay")])
        result = normalizer.resolve("América FC", tournament="Liga BetPlay")
        self.assertEqual(result.canonical_name, "América de Cali")
        self.assertEqual(result.status, "approved")

    def test_ambiguous_alias_is_not_silently_merged(self) -> None:
        normalizer = TeamNormalizer([
            TeamAlias("América de Cali", "America"),
            TeamAlias("America Mineiro", "America"),
        ])
        result = normalizer.resolve("America")
        self.assertEqual(result.status, "pending_review")
        self.assertIn("mas de un equipo", result.warnings[0])

    def test_pending_alias_remains_pending(self) -> None:
        normalizer = TeamNormalizer([TeamAlias("Millonarios", "Millos", status="pending_review", confidence=0.7)])
        result = normalizer.resolve("Millos")
        self.assertEqual(result.status, "pending_review")
        self.assertLess(result.confidence, 1)


if __name__ == "__main__":
    unittest.main()

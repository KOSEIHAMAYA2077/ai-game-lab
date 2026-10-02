"""Check that evaluation cannot turn transport/contract failures into success."""
import unittest
from evaluate import score


class ScoringChecks(unittest.TestCase):
    def test_null_is_correct_only_after_valid_response(self):
        case = {"expectedFamily": None}
        self.assertTrue(score(case, {"spec": None}, None)["meaningPass"])
        self.assertFalse(score(case, {}, None)["meaningPass"])
        self.assertFalse(score(case, {"spec": {}}, None)["meaningPass"])
        self.assertFalse(score(case, {"spec": None}, "TimeoutError")["meaningPass"])

    def test_correct_family_does_not_hide_wrong_dimensions(self):
        case = {"expectedFamily": "vase", "attributes": {"height": {"min": 1.2}, "width": {"max": .85}}}
        result = score(case, {"spec": {"family": "vase", "height": 1.5, "width": 1.4}}, None)
        self.assertTrue(result["familyPass"])
        self.assertFalse(result["meaningPass"])

    def test_non_finite_or_boolean_attributes_are_not_numbers(self):
        case = {"expectedFamily": "sword", "attributes": {"bend": {"minAbs": .25}}}
        for value in [float("nan"), float("inf"), True, "0.5"]:
            self.assertFalse(score(case, {"spec": {"family": "sword", "bend": value}}, None)["meaningPass"])

    def test_negative_bend_preserves_direction_free_curvature(self):
        case = {"expectedFamily": "sword", "attributes": {"bend": {"minAbs": .25}}}
        self.assertTrue(score(case, {"spec": {"family": "sword", "bend": -.6}}, None)["meaningPass"])


if __name__ == "__main__":
    unittest.main()

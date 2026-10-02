import unittest
from score import score, valid_program


def part(primitive, identifier, width=1):
    return {"id": identifier, "primitive": primitive, "height": 1, "width": width, "depth": 1, "bend": 0, "twist": 0}


class ScoringChecks(unittest.TestCase):
    def test_corrupt_response_cannot_be_correct_hold(self):
        case = {"expected": None}
        self.assertTrue(score(case, {"program": None})["meaningPass"])
        self.assertFalse(score(case, {})["meaningPass"])
        self.assertFalse(score(case, {"program": {}})["meaningPass"])
        self.assertFalse(score(case, {"program": None}, "Timeout")["meaningPass"])

    def test_types_match_but_roles_reverse(self):
        case = {"expected": {"parts": [{"primitive": "box"}, {"primitive": "sphere"}], "relation": "above"}}
        program = {"version": 1, "parts": [part("sphere", "0"), part("box", "1")], "relation": {"parent": "0", "child": "1", "kind": "above"}}
        result = score(case, {"program": program})
        self.assertTrue(result["partTypesPass"])
        self.assertFalse(result["rolesPass"])
        self.assertFalse(result["meaningPass"])

    def test_same_primitive_does_not_hide_swapped_dimensions(self):
        case = {"expected": {"parts": [{"primitive": "sphere", "attributes": {"width": {"min": 1.2}}}, {"primitive": "sphere", "attributes": {"width": {"max": .8}}}], "relation": "above"}}
        program = {"version": 1, "parts": [part("sphere", "0", .55), part("sphere", "1", 1.5)], "relation": {"parent": "0", "child": "1", "kind": "above"}}
        result = score(case, {"program": program})
        self.assertTrue(result["rolesPass"])
        self.assertFalse(result["attributePass"])
        self.assertFalse(result["meaningPass"])

    def test_relation_kind_is_independent_from_correct_parts(self):
        case = {"expected": {"parts": [{"primitive": "tube"}, {"primitive": "sphere"}], "relation": "end"}}
        program = {"version": 1, "parts": [part("tube", "0"), part("sphere", "1")], "relation": {"parent": "0", "child": "1", "kind": "above"}}
        result = score(case, {"program": program})
        self.assertTrue(result["rolesPass"])
        self.assertFalse(result["relationPass"])
        self.assertFalse(result["meaningPass"])

    def test_extra_fields_cannot_be_a_valid_finite_program(self):
        base = {"version": 1, "parts": [part("sphere", "0")]}
        self.assertFalse(valid_program({**base, "code": "execute"}))
        self.assertFalse(valid_program({**base, "parts": [{**base["parts"][0], "meshPath": "external"}]}))
        self.assertFalse(valid_program({**base, "version": True}))
        self.assertFalse(valid_program({**base, "relation": None}))

    def test_nonfinite_and_out_of_bounds_not_contract(self):
        for value in [True, float("nan"), float("inf"), 2, .1]:
            self.assertFalse(valid_program({"version": 1, "parts": [part("sphere", "0", value)]}))


if __name__ == "__main__":
    unittest.main()

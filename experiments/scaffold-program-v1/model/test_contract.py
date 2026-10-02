"""Bounded model-output contract. Does not need model download or inference."""
import copy
import math
import unittest

from predict import validate_program


def sample():
    return {"version": 1, "parts": [{"id": "0", "primitive": "sphere", "height": 1., "width": 1., "depth": 1., "bend": 0., "twist": 0.}]}


class ContractTest(unittest.TestCase):
    def test_single_part_is_valid(self):
        self.assertEqual(validate_program(sample()), sample())

    def test_same_primitive_two_parts_are_valid(self):
        value = sample()
        child = copy.deepcopy(value["parts"][0])
        child["id"] = "1"
        value["parts"].append(child)
        value["relation"] = {"kind": "above", "parent": "0", "child": "1"}
        self.assertEqual(validate_program(value), value)

    def test_nonfinite_or_boolean_numbers_are_rejected(self):
        for key in ["height", "width", "depth", "bend", "twist"]:
            for number in [math.nan, math.inf, -math.inf, True, "1", None]:
                with self.subTest(key=key, number=number):
                    value = sample()
                    value["parts"][0][key] = number
                    self.assertIsNone(validate_program(value))

    def test_each_numeric_bound_is_enforced(self):
        for key, low, high in [("height", .4, 1.8), ("width", .4, 1.8), ("depth", .4, 1.8), ("bend", -1., 1.), ("twist", -1., 1.)]:
            for number, valid in [(low, True), (high, True), (low-.001, False), (high+.001, False)]:
                with self.subTest(key=key, number=number):
                    value = sample()
                    value["parts"][0][key] = number
                    self.assertEqual(validate_program(value) is not None, valid)

    def test_unknown_geometry_and_extra_code_are_rejected(self):
        for mutation in ["unknown", "part-code", "program-code"]:
            with self.subTest(mutation=mutation):
                value = sample()
                if mutation == "unknown":
                    value["parts"][0]["primitive"] = "run-code"
                elif mutation == "part-code":
                    value["parts"][0]["code"] = "throw new Error()"
                else:
                    value["code"] = "throw new Error()"
                self.assertIsNone(validate_program(value))

    def test_three_parts_or_missing_relation_are_rejected(self):
        value = sample()
        child = copy.deepcopy(value["parts"][0])
        child["id"] = "1"
        value["parts"].append(child)
        self.assertIsNone(validate_program(value))
        value["relation"] = {"kind": "end", "parent": "0", "child": "1"}
        value["parts"].append({**child, "id": "2"})
        self.assertIsNone(validate_program(value))

    def test_wrong_parent_or_id_is_rejected(self):
        value = sample()
        value["parts"][0]["id"] = "9"
        self.assertIsNone(validate_program(value))
        value = sample()
        value["parts"].append({**value["parts"][0], "id": "1"})
        value["relation"] = {"kind": "end", "parent": "1", "child": "0"}
        self.assertIsNone(validate_program(value))

    def test_version_must_be_exact_integer(self):
        for version in [True, 1., "1", 0, 2, None]:
            with self.subTest(version=version):
                value = sample()
                value["version"] = version
                self.assertIsNone(validate_program(value))


if __name__ == "__main__":
    unittest.main()

"""Scorer mechanics only; ideal synthetic replies are not model accuracy."""
import json
import unittest
from pathlib import Path

import score_r1


class ScorerTests(unittest.TestCase):
    def setUp(self):
        self.cases = json.loads((Path(__file__).parent / "cases-r1.json").read_text())["cases"]
        self.entries = [{"case_id": c["case_id"], "raw_text": json.dumps(c["expected"]), "status": "ok"} for c in self.cases]

    def test_ideal_synthetic_aggregation(self):
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual((result["exact"], result["positive_exact"], result["hold_exact"]), (36, 24, 12))
        self.assertEqual({k: v["count"] for k, v in result["by_group"].items()}, {"named": 6, "appearance": 12, "mixed": 6, "hold": 12})

    def test_missing_denominator_preserved(self):
        result = score_r1.score(self.cases, [])
        self.assertEqual((result["count"], result["exact"], result["statuses"]), (36, 0, {"missing": 36}))

    def test_semantic_wrong_shape(self):
        self.entries[0]["raw_text"] = '{"action":"propose","shape":"sphere"}'
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["exact"], 35)
        self.assertEqual(result["statuses"]["semantic_mismatch"], 1)

    def test_markdown_not_repaired(self):
        self.entries[0]["raw_text"] = "```json\n" + self.entries[0]["raw_text"] + "\n```"
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["statuses"]["invalid_json"], 1)

    def test_duplicate_json_key_rejected(self):
        self.entries[0]["raw_text"] = '{"action":"hold","action":"propose","shape":"jellyfish"}'
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["statuses"]["invalid_json"], 1)

    def test_duplicate_case_reply_not_selected(self):
        self.entries.append(dict(self.entries[0]))
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["exact"], 35)
        self.assertFalse(result["input_integrity_ok"])

    def test_timeout_separate(self):
        self.entries[0]["status"] = "timeout"
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["statuses"]["timeout"], 1)
        self.assertEqual(result["exact"], 35)

    def test_hold_false_proposal(self):
        self.entries[24]["raw_text"] = '{"action":"propose","shape":"tree"}'
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["false_proposals_on_hold"], 1)
        self.assertEqual(result["hold_exact"], 11)

    def test_attributes_not_accepted_as_output(self):
        self.entries[18]["raw_text"] = '{"action":"propose","shape":"sphere","color":"blue"}'
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["statuses"]["contract_violation"], 1)

    def test_nan_not_json(self):
        with self.assertRaises(ValueError):
            score_r1.strict_json('{"shape":NaN}')

    def test_unknown_id_marked(self):
        self.entries.append({"case_id": "unknown", "raw_text": "{}", "status": "ok"})
        result = score_r1.score(self.cases, self.entries)
        self.assertEqual(result["exact"], 36)
        self.assertFalse(result["input_integrity_ok"])
        self.assertEqual(result["input_errors"][0]["type"], "unknown_case_id")


if __name__ == "__main__":
    unittest.main(verbosity=2)

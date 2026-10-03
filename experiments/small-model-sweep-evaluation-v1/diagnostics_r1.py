#!/usr/bin/env python3
"""Descriptive saved-value diagnostics, separate from the frozen main score."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
from collections import Counter

BASE = pathlib.Path(__file__).resolve().parent
RAW = BASE.parents[1] / ".local/small-model-sweep-v1/raw"
DEST = BASE / "results-r1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def valid_field(key, value, scorer):
    if key == "action":
        return isinstance(value, str) and value in {"propose", "hold"}
    if key == "shape":
        return value is None or (isinstance(value, str) and value in scorer.SHAPES)
    if key == "color":
        return value is None or (isinstance(value, str) and value in scorer.COLORS)
    if key == "motion":
        return value is None or (isinstance(value, str) and value in scorer.MOTIONS)
    return type(value) is int and 1 <= value <= 8


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True)
    args = parser.parse_args()
    if not args.snapshot.replace("-", "").isalnum():
        parser.error("snapshot must contain letters, digits, and hyphens only")
    spec = importlib.util.spec_from_file_location("diagnostic_frozen_score", BASE / "score.py")
    scorer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scorer)
    freeze = json.loads((BASE / "FREEZE-R1.json").read_text())
    for entry in freeze["files"]:
        if sha(BASE / entry["path"]) != entry["sha256"]:
            raise ValueError("evaluation changed: " + entry["path"])
    cases = json.loads((BASE / "cases-r1.json").read_text())["cases"]
    outputs = []
    for score_path in sorted(DEST.glob("*-score.json")):
        label = score_path.name[:-len("-score.json")]
        destination = DEST / (label + "-diagnostics.json")
        primary = json.loads(score_path.read_text())
        raw_path = RAW / label / "responses.jsonl"
        if sha(raw_path) != primary["raw_sha256"]:
            raise ValueError("raw changed after primary scoring: " + label)
        if destination.exists():
            out = json.loads(destination.read_text())
            if out["raw_sha256"] != primary["raw_sha256"]:
                raise ValueError("raw changed after diagnostics: " + label)
        else:
            raw_rows = [scorer.strict_load(line) for line in raw_path.read_text().splitlines() if line.strip()]
            counts = Counter(row["case_id"] for row in raw_rows)
            by_id = {row["case_id"]: row for row in raw_rows if counts[row["case_id"]] == 1}
            details = []
            primary_by_id = {row["case_id"]: row for row in primary["cases"]}
            for case in cases:
                row = by_id.get(case["case_id"])
                parsed = None
                if row is not None and row.get("status") == "ok" and isinstance(row.get("raw_text"), str):
                    try:
                        candidate = scorer.strict_load(row["raw_text"])
                        if isinstance(candidate, dict) and set(candidate) == scorer.FIELDS:
                            parsed = candidate
                    except (ValueError, TypeError):
                        pass
                expected = case["expected"]
                correct = {key: bool(parsed is not None and valid_field(key, parsed[key], scorer) and parsed[key] == expected[key]) for key in sorted(scorer.FIELDS)}
                details.append({"case_id": case["case_id"], "group": case["group"],
                                "expected_action": expected["action"], "strict_five_key_object": parsed is not None,
                                "original_schema_valid": primary_by_id[case["case_id"]]["schema_valid"],
                                "field_equal_ignoring_other_field_errors": correct,
                                "unspecified_color_filled": bool(parsed is not None and expected["color"] is None and isinstance(parsed["color"], str) and parsed["color"] in scorer.COLORS),
                                "unspecified_motion_filled": bool(parsed is not None and expected["motion"] is None and isinstance(parsed["motion"], str) and parsed["motion"] in scorer.MOTIONS)})
            propose = [row for row in details if row["expected_action"] == "propose"]
            propose_valid_primary = [row for row in primary["cases"] if row["expected"]["action"] == "propose"]
            out = {
                "version": "saved-reply-field-diagnostics-r1", "label": label,
                "raw_sha256": primary["raw_sha256"], "primary_score_sha256": sha(score_path),
                "primary_scorer_sha256": sha(BASE / "score.py"), "diagnostic_source_sha256": sha(pathlib.Path(__file__)),
                "model_calls": 0, "primary_exact_unchanged": primary["exact"], "denominator": 24,
                "frozen_primary_field_correct_schema_valid_only": primary["field_correct"],
                "diagnostic_field_equal_ignoring_other_field_errors": {key: sum(row["field_equal_ignoring_other_field_errors"][key] for row in details) for key in sorted(scorer.FIELDS)},
                "propose_shape_only_schema_valid_primary": {"correct": sum(row["field_correct"]["shape"] for row in propose_valid_primary), "denominator": len(propose_valid_primary)},
                "propose_shape_only_ignoring_other_field_errors": {"correct": sum(row["field_equal_ignoring_other_field_errors"]["shape"] for row in propose), "denominator": len(propose)},
                "unspecified_color_filled_count": sum(row["unspecified_color_filled"] for row in details),
                "unspecified_motion_filled_count": sum(row["unspecified_motion_filled"] for row in details),
                "by_group": {group: {"denominator": len([row for row in details if row["group"] == group]), "shape_equal_ignoring_other_field_errors": sum(row["field_equal_ignoring_other_field_errors"]["shape"] for row in details if row["group"] == group)} for group in sorted(set(row["group"] for row in details))},
                "notes": [
                    "Diagnostics were requested and implemented after initial saved model replies were observed, not a newly frozen primary metric.",
                    "Other-field-errors-ignored counts use original values in strict five-key JSON objects; no value is repaired, filled, cleared, or sent back to a model.",
                    "Diagnostic field counts are not adoptable reply counts, repaired accuracy, or arbitrary shape generation quality.",
                    "All field denominators remain24; propose-only shape denominators remain18 even for missing or failed cases."
                ], "cases": details
            }
            with destination.open("x") as handle:
                handle.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
        outputs.append({"label": label, "exact": out["primary_exact_unchanged"],
                        "fixed_field_correct": out["frozen_primary_field_correct_schema_valid_only"],
                        "diagnostic_field_correct": out["diagnostic_field_equal_ignoring_other_field_errors"],
                        "propose_shape": out["propose_shape_only_ignoring_other_field_errors"],
                        "unspecified_color_filled": out["unspecified_color_filled_count"],
                        "unspecified_motion_filled": out["unspecified_motion_filled_count"]})
    with (DEST / (args.snapshot + "-diagnostics.json")).open("x") as handle:
        handle.write(json.dumps({"version": "field-diagnostic-checkpoint-r1", "model_calls": 0, "runs": outputs}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(outputs, ensure_ascii=False))


if __name__ == "__main__":
    main()

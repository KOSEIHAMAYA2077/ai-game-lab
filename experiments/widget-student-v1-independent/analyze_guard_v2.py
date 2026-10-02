#!/usr/bin/env python3
"""Compare guard-v2 regression to preserved freeze-1 and rule first runs."""
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return json.loads((ROOT / path).read_text())


def quantile(values, q):
    if not values:
        return None
    values = sorted(values)
    pos = (len(values) - 1) * q
    a, b = math.floor(pos), math.ceil(pos)
    return values[a] + (values[b] - values[a]) * (pos - a)


def times(values):
    return {"count": len(values), "p50": quantile(values, .5), "p95": quantile(values, .95), "max": max(values) if values else None, "sum": sum(values)}


fixture = read("fixture-90-v1.json")
previous = read("results/overlap-and-comparison-v1.json")
raw = read("results/student-guard-v2-regression.json")
scored = read("results/student-guard-v2-regression-scored.json")
original = read("results/student-freeze-1-first-pass-scored.json")
excluded = {case["id"] for case in previous["overlap_cases"]}
rows = scored["rows"]
definite = [row for row in rows if row["expected_action"] != "any"]
positive = [row for row in rows if row["expected_action"] == "render"]
accepted = [row for row in definite if row["actual_action"] == "render" and row["safe_program"]]
accepted_positive = [row for row in positive if row["actual_action"] == "render" and row["safe_program"]]
cleaned = [row for row in definite if row["id"] not in excluded]
cleaned_positive = [row for row in positive if row["id"] not in excluded]
negated = [row for row in rows if row["expected_action"] == "hold" and row["category"] == "hold_negation_ambiguity"]
by_id = {prediction["id"]: prediction for prediction in raw["predictions"]}
old_by_id = {row["id"]: row for row in original["rows"]}
failures = []
for row in rows:
    if not row["semantic_success"] or row.get("geometry_failure"):
        case = next(case for case in fixture["cases"] if case["id"] == row["id"])
        failures.append({"id": row["id"], "text": case["text"], "expected": case["expected"], "prediction": by_id[row["id"]], "scored": row})
guard_holds = Counter(prediction.get("reason") for prediction in raw["predictions"] if prediction["program"] is None)
metric = {
    "scored_summary": scored["summary"],
    "accepted_definite_outputs": len(accepted),
    "accepted_definite_output_successes": sum(row["semantic_success"] for row in accepted),
    "accepted_definite_precision": sum(row["semantic_success"] for row in accepted) / len(accepted) if accepted else None,
    "positive_program_coverage_count": len(accepted_positive),
    "positive_program_coverage": len(accepted_positive) / len(positive),
    "positive_accepted_precision": sum(row["semantic_success"] for row in accepted_positive) / len(accepted_positive) if accepted_positive else None,
    "negation_cancellation_conflict_hold_successes": sum(row["semantic_success"] for row in negated),
    "negation_cancellation_conflict_hold_cases": len(negated),
    "normalized_overlap_excluded": {"definite_count": len(cleaned), "definite_semantic_successes": sum(row["semantic_success"] for row in cleaned),
                                    "definite_accuracy": sum(row["semantic_success"] for row in cleaned) / len(cleaned),
                                    "positive_count": len(cleaned_positive), "positive_semantic_successes": sum(row["semantic_success"] for row in cleaned_positive)},
    "hold_reasons": dict(guard_holds),
    "false_activations": [row["id"] for row in rows if row["failure"] == "false_activation"],
    "failures": failures,
    "changed_from_freeze_1": [{"id": row["id"], "before": old_by_id[row["id"]], "after": row}
                              for row in rows if row["semantic_success"] != old_by_id[row["id"]]["semantic_success"] or row["actual_action"] != old_by_id[row["id"]]["actual_action"]],
    "timing_decomposition_ms": {
        "classifier_all_cases": times([prediction["classifierMs"] for prediction in raw["predictions"]]),
        "classifier_called_cases": times([prediction["classifierMs"] for prediction in raw["predictions"] if prediction["classifierMs"] > 0]),
        "guard_all_cases_including_compile": times([prediction["guardMs"] for prediction in raw["predictions"]]),
        "reported_total_all_cases": times([prediction["modelMs"] for prediction in raw["predictions"]]),
        "wall_clock_all_cases": times([prediction["elapsed_ms"] for prediction in raw["predictions"]]),
    },
}
value = {"version": 1, "evaluation_status": "regression after independent 90-case fixture seen",
         "fixture_sha256": sha256((ROOT / "fixture-90-v1.json").read_bytes()).hexdigest(),
         "scorer_sha256": sha256((ROOT / "score.py").read_bytes()).hexdigest(),
         "weights_and_thresholds_changed": False,
         "overlap_exclusions_unchanged": sorted(excluded),
         "guard_v2": metric,
         "preserved_models": {name: {key: item for key, item in info.items() if key != "failures"} for name, info in previous["models"].items()},
         "interpretation": "Changes come from explicit guard/attribute/order/compiler rules on the same learned classifier. This is not new unseen accuracy or a training improvement."}
data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
path = ROOT / "results/guard-v2-comparison-regression.json"
if path.exists() and path.read_bytes() != data:
    raise SystemExit("Refusing to overwrite prior regression analysis.")
path.write_bytes(data)
print(json.dumps({key: val for key, val in metric.items() if key not in {"scored_summary", "failures", "changed_from_freeze_1"}}, ensure_ascii=False, indent=2))

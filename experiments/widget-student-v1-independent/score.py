#!/usr/bin/env python3
"""Score already produced Programs without importing a model or training source."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
import math
from pathlib import Path
import statistics

PRIMITIVES = {"sphere", "box", "tube", "blade", "ring", "vase"}
DIMENSIONS = {"height", "width", "depth"}
FIELDS = DIMENSIONS | {"bend", "twist"}


def finite_number(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def valid_program(value):
    if not isinstance(value, dict) or set(value) - {"version", "parts", "relation"} or isinstance(value.get("version"), bool) or value.get("version") != 1:
        return False
    parts = value.get("parts")
    if not isinstance(parts, list) or not 1 <= len(parts) <= 2:
        return False
    ids = set()
    for part in parts:
        if not isinstance(part, dict) or set(part) != {"id", "primitive", *FIELDS}:
            return False
        identifier = part["id"]
        if not isinstance(identifier, str) or not 1 <= len(identifier) <= 24 or not all(c.isascii() and (c.isalnum() or c in "_-") for c in identifier) or identifier in ids:
            return False
        ids.add(identifier)
        if not isinstance(part["primitive"], str) or part["primitive"] not in PRIMITIVES:
            return False
        for name in FIELDS:
            number = part[name]
            low, high = (.4, 1.8) if name in DIMENSIONS else (-1, 1)
            if not finite_number(number) or not low <= number <= high:
                return False
    relation = value.get("relation")
    if len(parts) == 2:
        if not isinstance(relation, dict) or set(relation) != {"kind", "parent", "child"}:
            return False
        if not isinstance(relation["kind"], str) or relation["kind"] not in {"end", "above", "through"} or relation["parent"] != parts[0]["id"] or relation["child"] != parts[1]["id"]:
            return False
    elif "relation" in value:
        return False
    return True


def satisfies(part, condition):
    left_name = condition["left"]
    left = abs(part[left_name[4:]]) if left_name.startswith("abs_") else part[left_name]
    right = part[condition["right"]] * condition.get("ratio", 1) if "right" in condition else condition["value"]
    operation = condition["operation"]
    return {"lt": lambda: left < right, "lte": lambda: left <= right,
            "gt": lambda: left > right, "gte": lambda: left >= right}[operation]()


def compare(program, alternative):
    actual = program["parts"]
    expected = alternative["parts"]
    failures = []
    if len(actual) != len(expected):
        failures.append("part_count")
    names = [part["primitive"] for part in actual]
    wanted = [part["primitive"] for part in expected]
    if names != wanted:
        failures.append("roles_reversed" if len(names) == len(wanted) == 2 and names == list(reversed(wanted)) and wanted[0] != wanted[1] else "primitive")
    actual_relation = program.get("relation", {}).get("kind")
    if actual_relation != alternative.get("relation"):
        failures.append("relation")
    attribute_failures = []
    if len(actual) == len(expected) and names == wanted:
        for index, (actual_part, expected_part) in enumerate(zip(actual, expected)):
            for condition in expected_part.get("constraints", []):
                if not satisfies(actual_part, condition):
                    attribute_failures.append({"part_index": index, "condition": condition,
                                               "actual": {name: actual_part[name] for name in FIELDS}})
    if attribute_failures:
        failures.append("attribute")
    return {"failures": failures, "attribute_failures": attribute_failures,
            "part_count_correct": len(actual) == len(expected),
            "ordered_primitives_correct": names == wanted,
            "relation_correct": actual_relation == alternative.get("relation"),
            "structure_correct": not any(reason != "attribute" for reason in failures)}


def score_case(case, prediction):
    raw = prediction.get("program")
    expected = case["expected"]
    row = {"id": case["id"], "category": case["category"], "language": case["language"],
           "expected_action": expected["action"], "actual_action": "hold" if raw is None else "render",
           "semantic_success": False, "failure": None, "failures": [],
           "safe_program": raw is None, "geometry_success": None}
    if prediction.get("error"):
        row["failure"] = "timeout/error"
        row["failures"] = [row["failure"]]
    elif raw is not None and not valid_program(raw):
        row["failure"] = "invalid_schema"
        row["failures"] = [row["failure"]]
        row["safe_program"] = False
    elif expected["action"] == "hold":
        row["safe_program"] = True
        row["semantic_success"] = raw is None
        if raw is not None:
            row["failure"] = "false_activation"
            row["failures"] = [row["failure"]]
    elif raw is None:
        row["semantic_success"] = expected["action"] == "any" and expected.get("allow_hold", False)
        if not row["semantic_success"]:
            row["failure"] = "abstained_positive"
            row["failures"] = [row["failure"]]
    else:
        row["safe_program"] = True
        candidates = [compare(raw, alternative) for alternative in expected["alternatives"]]
        best_index = min(range(len(candidates)), key=lambda i: len(candidates[i]["failures"]))
        row.update(candidates[best_index])
        row["matched_alternative"] = best_index
        row["semantic_success"] = not row["failures"]
        row["failure"] = row["failures"][0] if row["failures"] else None
    geometry = prediction.get("geometry")
    if raw is not None and row["safe_program"] and isinstance(geometry, dict):
        compiled = geometry.get("compiled") is True
        finite = geometry.get("finite") is True
        row["geometry_success"] = compiled and finite
        if not compiled:
            row["geometry_failure"] = "geometry_rejected"
        elif not finite:
            row["geometry_failure"] = "nonfinite_geometry"
        if raw.get("relation", {}).get("kind") == "through" and geometry.get("through_material") is not True:
            row["geometry_success"] = False
            row["geometry_failure"] = "geometry_rejected"
    # A true null/hold needs no geometry compilation. Other cases with no geometry
    # evidence stay unknown, rather than being silently counted as pipeline passes.
    row["pipeline_success"] = row["semantic_success"] if raw is None else (
        row["semantic_success"] and row["geometry_success"] if row["geometry_success"] is not None else None)
    if finite_number(prediction.get("elapsed_ms")) and prediction["elapsed_ms"] >= 0:
        row["elapsed_ms"] = prediction["elapsed_ms"]
    return row


def quantile(values, q):
    if not values:
        return None
    values = sorted(values)
    pos = (len(values) - 1) * q
    low = math.floor(pos)
    high = math.ceil(pos)
    return values[low] + (values[high] - values[low]) * (pos - low)


def summarize(fixture, result):
    predictions = result.get("predictions")
    if not isinstance(predictions, list):
        raise ValueError("Predictions must be an array.")
    ids = [prediction.get("id") for prediction in predictions]
    wanted_ids = [case["id"] for case in fixture["cases"]]
    if len(ids) != len(set(ids)) or set(ids) != set(wanted_ids):
        raise ValueError("Exactly one prediction for every frozen case is required; no duplicate or extra ids.")
    indexed = {prediction["id"]: prediction for prediction in predictions}
    rows = [score_case(case, indexed[case["id"]]) for case in fixture["cases"]]
    definite = [row for row in rows if row["expected_action"] != "any"]
    render = [row for row in rows if row["expected_action"] == "render"]
    hold = [row for row in rows if row["expected_action"] == "hold"]
    ambiguous = [row for row in rows if row["expected_action"] == "any"]
    by_category = {}
    for category in fixture["categories"]:
        selected = [row for row in rows if row["category"] == category]
        by_category[category] = {"count": len(selected), "successes": sum(row["semantic_success"] for row in selected),
                                 "failures": dict(Counter(row["failure"] for row in selected if row["failure"]))}
    pairs = [[f"r{2*i+1:02}", f"r{2*i+2:02}"] for i in range(15)]
    row_ids = {row["id"]: row for row in rows}
    passed_pairs = [pair for pair in pairs if all(row_ids[identifier]["semantic_success"] for identifier in pair)]
    latencies = [row["elapsed_ms"] for row in rows if "elapsed_ms" in row]
    geometry_measured = [row for row in rows if row["geometry_success"] is not None]
    pipeline_measured = [row for row in definite if row["pipeline_success"] is not None]
    summary = {
        "cases": len(rows), "definite_cases": len(definite),
        "definite_semantic_successes": sum(row["semantic_success"] for row in definite),
        "definite_semantic_accuracy": sum(row["semantic_success"] for row in definite) / len(definite),
        "render_cases": len(render), "render_successes": sum(row["semantic_success"] for row in render),
        "positive_abstentions": sum(row["actual_action"] == "hold" for row in render),
        "hold_cases": len(hold), "hold_successes": sum(row["semantic_success"] for row in hold),
        "false_activations": sum(row["failure"] == "false_activation" for row in hold),
        "invalid_programs": sum(row["failure"] == "invalid_schema" for row in rows),
        "ambiguous_cases": len(ambiguous), "ambiguous_acceptable": sum(row["semantic_success"] for row in ambiguous),
        "reversed_role_pairs": len(pairs), "both_directions_correct_pairs": len(passed_pairs),
        "both_directions_correct_pair_ids": passed_pairs,
        "geometry_measured_outputs": len(geometry_measured),
        "geometry_safe_outputs": sum(row["geometry_success"] for row in geometry_measured),
        "pipeline_measured_definite_cases": len(pipeline_measured),
        "pipeline_successes_on_measured_definite_cases": sum(row["pipeline_success"] for row in pipeline_measured),
        "failure_taxonomy": dict(Counter(row["failure"] for row in rows if row["failure"])),
        "geometry_failures": dict(Counter(row["geometry_failure"] for row in rows if row.get("geometry_failure"))),
        "categories": by_category,
        "model_only_latency_ms": {"count": len(latencies), "p50": quantile(latencies, .5), "p95": quantile(latencies, .95),
                                  "max": max(latencies) if latencies else None},
    }
    return {"version": 1, "model_name": result.get("model_name", "unspecified"),
            "frozen_manifest": result.get("frozen_manifest"), "environment": result.get("environment"),
            "resource_measurements": result.get("resource_measurements"), "summary": summary, "rows": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, default=Path(__file__).with_name("fixture-90-v1.json"))
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    fixture_bytes = args.fixture.read_bytes()
    result = summarize(json.loads(fixture_bytes), json.loads(args.predictions.read_bytes()))
    result["fixture_sha256"] = sha256(fixture_bytes).hexdigest()
    result["prediction_sha256"] = sha256(args.predictions.read_bytes()).hexdigest()
    data = (json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if args.output.exists() and args.output.read_bytes() != data:
        raise SystemExit("Refusing to replace an existing result. Use a new versioned output path.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()

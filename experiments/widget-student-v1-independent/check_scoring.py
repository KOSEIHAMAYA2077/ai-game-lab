#!/usr/bin/env python3
"""Integrity probes: oracle, all-hold, role reversal and invalid geometry data."""
from copy import deepcopy
import json
from pathlib import Path
from score import summarize, valid_program

ROOT = Path(__file__).resolve().parent
fixture = json.loads((ROOT / "fixture-90-v1.json").read_text())


def make_program(alternative):
    parts = []
    for index, wanted in enumerate(alternative["parts"]):
        part = {"id": f"p{index}", "primitive": wanted["primitive"],
                "height": 1.0, "width": 1.0, "depth": 1.0, "bend": 0.0, "twist": 0.0}
        for constraint in wanted.get("constraints", []):
            field = constraint["left"]
            field = field[4:] if field.startswith("abs_") else field
            if "right" in constraint:
                target = part[constraint["right"]] * constraint.get("ratio", 1)
            else:
                target = constraint["value"]
            if constraint["operation"] == "lt":
                target -= .1
            elif constraint["operation"] == "gt":
                target += .1
            part[field] = target
        parts.append(part)
    program = {"version": 1, "parts": parts}
    if "relation" in alternative:
        program["relation"] = {"kind": alternative["relation"], "parent": "p0", "child": "p1"}
    return program


oracle = []
for case in fixture["cases"]:
    expected = case["expected"]
    value = make_program(expected["alternatives"][0]) if expected["action"] == "render" else None
    oracle.append({"id": case["id"], "program": value})
report = summarize(fixture, {"model_name": "scorer-oracle", "predictions": oracle})["summary"]
assert report["definite_semantic_successes"] == 86, report
assert report["render_successes"] == 60 and report["hold_successes"] == 26
assert report["both_directions_correct_pairs"] == 15
assert report["geometry_measured_outputs"] == 0
assert report["pipeline_measured_definite_cases"] == 26  # Holds, not the unmeasured generated geometry.

all_hold = [{"id": case["id"], "program": None} for case in fixture["cases"]]
report = summarize(fixture, {"predictions": all_hold})["summary"]
assert report["definite_semantic_successes"] == 26
assert report["render_successes"] == 0 and report["positive_abstentions"] == 60

reverse = deepcopy(oracle)
for row in reverse:
    program = row["program"]
    if program and len(program["parts"]) == 2:
        program["parts"] = list(reversed(program["parts"]))
        program["relation"]["parent"] = program["parts"][0]["id"]
        program["relation"]["child"] = program["parts"][1]["id"]
report = summarize(fixture, {"predictions": reverse})["summary"]
assert report["both_directions_correct_pairs"] == 0
assert report["failure_taxonomy"]["roles_reversed"] == 30

unsafe = deepcopy(oracle)
unsafe[0]["program"]["parts"][0]["height"] = float("nan")
unsafe[60]["program"] = {"version": 1, "parts": []}  # Invalid output must not be treated as a correct hold.
report = summarize(fixture, {"predictions": unsafe})["summary"]
assert report["invalid_programs"] == 2 and report["definite_semantic_successes"] == 84
for mutate in (
    lambda p: p.update(version=True),
    lambda p: p.update(relation=None),
    lambda p: p["parts"][0].update(primitive={}),
):
    malformed = deepcopy(oracle[0]["program"])
    mutate(malformed)
    assert not valid_program(malformed)

error_holds = deepcopy(all_hold)
error_holds[60]["error"] = "timeout"
report = summarize(fixture, {"predictions": error_holds})["summary"]
assert report["hold_successes"] == 25 and report["failure_taxonomy"]["timeout/error"] == 1

bad_geometry = deepcopy(oracle)
bad_geometry[0]["geometry"] = {"compiled": True, "finite": False}
bad_geometry[1]["geometry"] = {"compiled": False, "finite": False}
bad_geometry[50]["geometry"] = {"compiled": True, "finite": True, "through_material": False}
report = summarize(fixture, {"predictions": bad_geometry})["summary"]
assert report["geometry_measured_outputs"] == 3 and report["geometry_safe_outputs"] == 0
assert report["geometry_failures"] == {"nonfinite_geometry": 1, "geometry_rejected": 2}

try:
    summarize(fixture, {"predictions": oracle[:-1]})
except ValueError:
    pass
else:
    raise AssertionError("Incomplete run must not be silently scored.")

print("Scorer integrity: oracle, all-hold, role reversal, invalid Program, error-hold, unsafe geometry and missing case probes passed.")

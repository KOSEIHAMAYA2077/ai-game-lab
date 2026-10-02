"""Score finite scaffold programs without conflating contract and meaning."""
from __future__ import annotations
import math
from collections import Counter

PRIMITIVES = {"sphere", "box", "tube", "blade", "ring", "vase"}
RELATIONS = {"end", "above", "through"}
BOUNDS = {"height": (.4, 1.8), "width": (.4, 1.8), "depth": (.4, 1.8), "bend": (-1, 1), "twist": (-1, 1)}


def valid_program(program: object) -> bool:
    if program is None:
        return True
    if not isinstance(program, dict) or set(program) - {"version", "parts", "relation"} or type(program.get("version")) is not int or program.get("version") != 1:
        return False
    parts = program.get("parts")
    if not isinstance(parts, list) or not 1 <= len(parts) <= 2:
        return False
    for index, part in enumerate(parts):
        if not isinstance(part, dict) or set(part) != {"id", "primitive", *BOUNDS} or part.get("id") != str(index) or part.get("primitive") not in PRIMITIVES:
            return False
        for key, (minimum, maximum) in BOUNDS.items():
            value = part.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or not minimum <= value <= maximum:
                return False
    relation = program.get("relation")
    if len(parts) == 1:
        return "relation" not in program
    return isinstance(relation, dict) and set(relation) == {"kind", "parent", "child"} and relation.get("kind") in RELATIONS and relation.get("parent") == "0" and relation.get("child") == "1"


def score(case: dict, output: dict, error: str | None = None) -> dict:
    expected = case["expected"]
    program = output.get("program")
    contract_pass = error is None and "program" in output and valid_program(program)
    if expected is None:
        hold_pass = contract_pass and program is None
        return {"requestedProgram": False, "contractPass": contract_pass, "holdPass": hold_pass, "partCountPass": hold_pass,
                "partTypesPass": hold_pass, "rolesPass": hold_pass, "relationPass": hold_pass,
                "attributePass": hold_pass, "attributeChecks": [], "meaningPass": hold_pass}
    if not isinstance(program, dict) or not isinstance(program.get("parts"), list):
        missing_checks = [{"partIndex": index, "primitive": part["primitive"], "attribute": key, "actual": None, "expected": condition, "pass": False} for index, part in enumerate(expected["parts"]) for key, condition in part.get("attributes", {}).items()]
        return {"requestedProgram": True, "contractPass": contract_pass, "holdPass": False, "partCountPass": False,
                "partTypesPass": False, "rolesPass": False, "relationPass": False,
                "attributePass": not missing_checks, "attributeChecks": missing_checks, "meaningPass": False}
    parts = program["parts"]
    expected_parts = expected["parts"]
    actual_names = [part.get("primitive") if isinstance(part, dict) else None for part in parts]
    expected_names = [part["primitive"] for part in expected_parts]
    count_pass = len(parts) == len(expected_parts)
    types_pass = count_pass and Counter(actual_names) == Counter(expected_names)
    roles_pass = count_pass and actual_names == expected_names
    actual_relation = program.get("relation")
    relation_pass = (actual_relation is None if expected["relation"] is None else
                     isinstance(actual_relation, dict) and actual_relation.get("kind") == expected["relation"] and actual_relation.get("parent") == "0" and actual_relation.get("child") == "1")
    checks = []
    for index, expected_part in enumerate(expected_parts):
        actual_part = parts[index] if index < len(parts) and isinstance(parts[index], dict) else {}
        for key, condition in expected_part.get("attributes", {}).items():
            value = actual_part.get(key)
            numeric = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
            passed = numeric and ("min" not in condition or value >= condition["min"]) and ("max" not in condition or value <= condition["max"]) and ("minAbs" not in condition or abs(value) >= condition["minAbs"])
            checks.append({"partIndex": index, "primitive": expected_part["primitive"], "attribute": key, "actual": value, "expected": condition, "pass": bool(passed)})
    attributes_pass = all(item["pass"] for item in checks)
    return {"requestedProgram": True, "contractPass": contract_pass, "holdPass": program is None, "partCountPass": count_pass,
            "partTypesPass": types_pass, "rolesPass": roles_pass, "relationPass": relation_pass,
            "attributePass": attributes_pass, "attributeChecks": checks,
            "meaningPass": contract_pass and roles_pass and relation_pass and attributes_pass}


def quantile(values: list[float], proportion: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    at = (len(values) - 1) * proportion
    low, high = math.floor(at), math.ceil(at)
    return values[low] + (values[high] - values[low]) * (at - low)


def summarize(rows: list[dict]) -> dict:
    groups = {}
    for group in sorted({row["group"] for row in rows}):
        subset = [row for row in rows if row["group"] == group]
        groups[group] = {"cases": len(subset), **{key: sum(bool(row[key]) for row in subset) for key in ["partCountPass", "partTypesPass", "rolesPass", "relationPass", "attributePass", "meaningPass"]}}
    attribute_checks = [check for row in rows for check in row["attributeChecks"]]
    latencies = [row["wallMs"] for row in rows if row.get("error") is None and isinstance(row.get("wallMs"), (float, int))]
    return {"cases": len(rows), **{key: sum(bool(row[key]) for row in rows) for key in ["contractPass", "partCountPass", "partTypesPass", "rolesPass", "relationPass", "attributePass", "meaningPass"]},
            "requestedProgramCases": sum(row["requestedProgram"] for row in rows), "correctProgramCases": sum(row["requestedProgram"] and row["meaningPass"] for row in rows),
            "intendedHoldCases": sum(not row["requestedProgram"] for row in rows), "correctHoldCases": sum(not row["requestedProgram"] and row["meaningPass"] for row in rows),
            "attributeCases": sum(bool(row["attributeChecks"]) for row in rows), "attributeCasePass": sum(bool(row["attributeChecks"]) and row["attributePass"] for row in rows),
            "attributeConditions": len(attribute_checks), "attributeConditionPass": sum(check["pass"] for check in attribute_checks),
            "wallP50Ms": quantile(latencies, .5), "wallP95Ms": quantile(latencies, .95), "groups": groups}

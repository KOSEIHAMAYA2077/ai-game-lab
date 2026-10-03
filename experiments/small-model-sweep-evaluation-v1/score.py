#!/usr/bin/env python3
"""Score saved runner output only; never invokes a model or alters fixtures."""
import argparse
import hashlib
import json
import pathlib
from collections import Counter


FIELDS = {"action", "shape", "color", "count", "motion"}
SHAPES = {"sphere", "box", "mobius", "vase", "sword", "jellyfish", "flower", "fireworks", "tree", "bird", "fish", "snake"}
COLORS = {"white", "red", "blue", "yellow", "green"}
MOTIONS = {"still", "flow", "pulse"}
HOLD = {"action": "hold", "shape": None, "color": None, "count": 1, "motion": None}


def reject_constant(value):
    raise ValueError("nonfinite JSON constant: " + value)


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError("duplicate JSON key: " + key)
        out[key] = value
    return out


def strict_load(text):
    return json.loads(text, object_pairs_hook=unique_object, parse_constant=reject_constant)


def decode_reply(text):
    if not isinstance(text, str):
        return None, False, "raw_text must be a string"
    try:
        obj = strict_load(text)
    except (ValueError, TypeError) as exc:
        return None, False, "JSON: " + str(exc)
    if not isinstance(obj, dict):
        return obj, False, "reply must be an object"
    if set(obj) != FIELDS:
        return obj, False, "reply must have exactly five contract keys"
    if obj["action"] not in ("propose", "hold"):
        return obj, False, "unsupported action"
    if type(obj["count"]) is not int or not 1 <= obj["count"] <= 8:
        return obj, False, "count must be an integer from 1 through 8 (boolean is invalid)"
    if obj["color"] is not None and (not isinstance(obj["color"], str) or obj["color"] not in COLORS):
        return obj, False, "unsupported color"
    if obj["motion"] is not None and (not isinstance(obj["motion"], str) or obj["motion"] not in MOTIONS):
        return obj, False, "unsupported motion"
    if obj["action"] == "hold":
        if obj != HOLD:
            return obj, False, "hold must clear shape/color/motion and set count to one"
    elif not isinstance(obj["shape"], str) or obj["shape"] not in SHAPES:
        return obj, False, "propose requires one supported shape"
    return obj, True, None


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def score(cases_path, raw_path):
    fixture = strict_load(pathlib.Path(cases_path).read_text(encoding="utf-8"))
    cases = fixture["cases"]
    ids = [case["case_id"] for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("fixture contains duplicate case IDs")
    for case in cases:
        _, valid, error = decode_reply(json.dumps(case["expected"]))
        if not valid:
            raise ValueError("fixture expectation violates contract: " + str(error))
    records = []
    malformed = []
    for number, line in enumerate(pathlib.Path(raw_path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            malformed.append({"line": number, "error": "empty JSONL line"})
            continue
        try:
            rec = strict_load(line)
            if not isinstance(rec, dict) or not isinstance(rec.get("case_id"), str):
                raise ValueError("record requires a string case_id")
            records.append(rec)
        except (ValueError, TypeError) as exc:
            malformed.append({"line": number, "error": str(exc)})
    counts = Counter(rec["case_id"] for rec in records)
    by_id = {rec["case_id"]: rec for rec in records if counts[rec["case_id"]] == 1}
    details = []
    for case in cases:
        case_id = case["case_id"]
        rec = by_id.get(case_id)
        pred = None
        valid = False
        if counts[case_id] > 1:
            error = "duplicate runner records for case_id"
        elif rec is None:
            error = "missing runner record"
        elif rec.get("status") != "ok":
            error = "runner status is not ok: " + str(rec.get("status"))
        elif "raw_text" not in rec:
            error = "runner record has no raw_text"
        else:
            pred, valid, error = decode_reply(rec["raw_text"])
        expected = case["expected"]
        details.append({
            "case_id": case_id, "group": case["group"], "expected": expected,
            "predicted": pred, "schema_valid": valid, "error": error,
            "exact": bool(valid and pred == expected),
            "field_correct": {key: bool(valid and pred[key] == expected[key]) for key in sorted(FIELDS)},
            "false_propose": bool(valid and expected["action"] == "hold" and pred["action"] == "propose"),
            "false_hold": bool(valid and expected["action"] == "propose" and pred["action"] == "hold")
        })
    groups = {}
    for group in sorted(set(case["group"] for case in cases)):
        rows = [row for row in details if row["group"] == group]
        groups[group] = {"denominator": len(rows), "schema_valid": sum(row["schema_valid"] for row in rows), "exact": sum(row["exact"] for row in rows)}
    return {
        "version": "small-model-sweep-score-r1",
        "cases_sha256": sha(cases_path), "raw_sha256": sha(raw_path), "scorer_sha256": sha(__file__),
        "denominator": len(cases), "runner_record_count": len(records),
        "schema_valid": sum(row["schema_valid"] for row in details),
        "exact": sum(row["exact"] for row in details),
        "field_correct": {key: sum(row["field_correct"][key] for row in details) for key in sorted(FIELDS)},
        "false_propose_valid_schema": sum(row["false_propose"] for row in details),
        "false_hold_valid_schema": sum(row["false_hold"] for row in details),
        "hold_denominator": sum(case["expected"]["action"] == "hold" for case in cases),
        "propose_denominator": sum(case["expected"]["action"] == "propose" for case in cases),
        "by_group": groups,
        "input_integrity": {
            "missing_ids": [case_id for case_id in ids if counts[case_id] == 0],
            "duplicate_ids": sorted(case_id for case_id, number in counts.items() if number > 1),
            "unknown_ids": sorted(set(counts) - set(ids)), "malformed_records": malformed
        },
        "notes": [
            "All primary field denominators include every fixed case; invalid/missing/failed replies earn zero.",
            "False propose/hold counts only schema-valid replies and are not a substitute for exact accuracy.",
            "No fence stripping, JSON extraction, repair, or model-output-driven expectation edits are performed.",
            "Descriptive metaphor labels are finite author-defined targets, not proof of subjective aesthetic usefulness."
        ],
        "cases": details
    }


def self_check():
    good = json.dumps({"action": "propose", "shape": "sphere", "color": None, "count": 1, "motion": None})
    rows = [
        ("one valid proposal", good, True),
        ("one valid hold", json.dumps(HOLD), True),
        ("allowed whitespace", "\n " + good + "\t", True),
        ("markdown fence rejected", "```json\n" + good + "\n```", False),
        ("extra explanation rejected", good + "\nThis is a sphere.", False),
        ("duplicate key rejected", '{"action":"hold","action":"propose","shape":"sphere","color":null,"count":1,"motion":null}', False),
        ("boolean count rejected", '{"action":"hold","shape":null,"color":null,"count":true,"motion":null}', False),
        ("float count rejected", '{"action":"hold","shape":null,"color":null,"count":1.0,"motion":null}', False),
        ("unsupported shape rejected", good.replace('"sphere"', '"torus"'), False),
        ("missing shape rejected", good.replace('"sphere"', 'null'), False),
        ("count above range rejected", good.replace('"count": 1', '"count": 9'), False),
        ("nonfinite rejected", good.replace('"count": 1', '"count": NaN'), False),
        ("hold attributes rejected", json.dumps(dict(HOLD, color="red")), False),
        ("array color rejected", good.replace('"color": null', '"color": []'), False),
        ("object motion rejected", good.replace('"motion": null', '"motion": {}'), False),
        ("extra key rejected", good[:-1] + ', "reason":"x"}', False)
    ]
    result = []
    for name, text, expected in rows:
        _, actual, error = decode_reply(text)
        result.append({"name": name, "expected_valid": expected, "actual_valid": actual, "passed": actual == expected, "diagnostic": error})
    return {"version": "scorer-self-check-r1", "model_calls": 0, "cases": result, "passed": sum(row["passed"] for row in result), "total": len(result), "scorer_sha256": sha(__file__)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=pathlib.Path, default=pathlib.Path(__file__).with_name("cases-r1.json"))
    parser.add_argument("--raw", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()
    if args.self_check:
        result = self_check()
    elif args.raw:
        result = score(args.cases, args.raw)
    else:
        parser.error("--raw is required unless --self-check is given")
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("passed", "total", "exact", "denominator", "schema_valid") if key in result}))


if __name__ == "__main__":
    main()

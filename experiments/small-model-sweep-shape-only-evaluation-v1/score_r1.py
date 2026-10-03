"""Independent frozen shape/action score, exact whole-message JSON, no model."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHAPES = {"sphere", "box", "mobius", "vase", "sword", "jellyfish",
          "flower", "fireworks", "tree", "bird", "fish", "snake"}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def strict_json(text):
    def pairs(values):
        value = {}
        for key, item in values:
            if key in value:
                raise ValueError("duplicate_json_key")
            value[key] = item
        return value

    def constant(_):
        raise ValueError("non_json_number")

    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)


def valid_contract(value):
    if not isinstance(value, dict) or set(value) != {"action", "shape"}:
        return False
    if value["action"] == "hold":
        return value["shape"] is None
    if value["action"] == "propose":
        return isinstance(value["shape"], str) and value["shape"] in SHAPES
    return False


def score(cases, entries, input_errors=None):
    errors = list(input_errors or [])
    ids = {c["case_id"] for c in cases}
    collected = {}
    for number, entry in enumerate(entries, 1):
        if not isinstance(entry, dict) or not isinstance(entry.get("case_id"), str):
            errors.append({"entry": number, "type": "invalid_entry"})
            continue
        if entry["case_id"] not in ids:
            errors.append({"entry": number, "type": "unknown_case_id", "case_id": entry["case_id"]})
            continue
        collected.setdefault(entry["case_id"], []).append(entry)
    rows = []
    for case in cases:
        values = collected.get(case["case_id"], [])
        row = {"case_id": case["case_id"], "group": case["group"],
               "expected": case["expected"], "status": None,
               "contract_ok": False, "exact_ok": False,
               "false_proposal_on_hold": False, "prediction": None}
        if not values:
            row["status"] = "missing"
        elif len(values) != 1:
            row["status"] = "duplicate_response"
        elif values[0].get("status") != "ok":
            status = values[0].get("status")
            row["status"] = "timeout" if status == "timeout" else "runtime_error"
        elif not isinstance(values[0].get("raw_text"), str):
            row["status"] = "invalid_raw_text"
        else:
            try:
                value = strict_json(values[0]["raw_text"])
            except (ValueError, TypeError):
                row["status"] = "invalid_json"
            else:
                row["contract_ok"] = valid_contract(value)
                if row["contract_ok"]:
                    row["prediction"] = value
                    row["exact_ok"] = value == case["expected"]
                    row["false_proposal_on_hold"] = (case["expected"]["action"] == "hold" and value["action"] == "propose")
                    row["status"] = "exact" if row["exact_ok"] else "semantic_mismatch"
                else:
                    row["status"] = "contract_violation"
        rows.append(row)
    by_group = {}
    for group in sorted({c["group"] for c in cases}):
        subset = [r for r in rows if r["group"] == group]
        by_group[group] = {"count": len(subset), "exact": sum(r["exact_ok"] for r in subset),
                           "contract_ok": sum(r["contract_ok"] for r in subset)}
    positive = [r for r in rows if r["expected"]["action"] == "propose"]
    held = [r for r in rows if r["expected"]["action"] == "hold"]
    return {"version": "shape-only-score-r1", "count": len(rows),
            "exact": sum(r["exact_ok"] for r in rows),
            "contract_ok": sum(r["contract_ok"] for r in rows),
            "positive_count": len(positive), "positive_exact": sum(r["exact_ok"] for r in positive),
            "hold_count": len(held), "hold_exact": sum(r["exact_ok"] for r in held),
            "false_proposals_on_hold": sum(r["false_proposal_on_hold"] for r in held),
            "statuses": dict(Counter(r["status"] for r in rows)),
            "by_group": by_group, "input_errors": errors,
            "input_integrity_ok": not errors and all(r["status"] not in {"missing", "duplicate_response"} for r in rows),
            "cases": rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=ROOT / "cases-r1.json")
    parser.add_argument("--responses", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        parser.error("output exists; preserve prior result and use a new output")
    fixture = strict_json(args.fixture.read_text(encoding="utf-8"))
    entries = []
    errors = []
    for number, line in enumerate(args.responses.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            entries.append(strict_json(line))
        except ValueError:
            errors.append({"line": number, "type": "invalid_jsonl"})
    result = score(fixture["cases"], entries, errors)
    result.update(fixture_sha256=sha256(args.fixture), responses_sha256=sha256(args.responses),
                  scorer_sha256=sha256(__file__))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"count": result["count"], "exact": result["exact"],
                      "contract_ok": result["contract_ok"], "input_integrity_ok": result["input_integrity_ok"]}))


if __name__ == "__main__":
    main()

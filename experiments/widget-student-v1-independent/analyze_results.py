#!/usr/bin/env python3
"""Post-freeze result analysis and exact/normalized corpus overlap inspection."""
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]


def read(relative):
    return json.loads((ROOT / relative).read_text())


def normalize(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).lower()).strip()


def write_once(name, value):
    path = ROOT / name
    data = (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    if path.exists() and path.read_bytes() != data:
        raise SystemExit(f"Refusing to overwrite {path.name}")
    path.write_bytes(data)


fixture = read("fixture-90-v1.json")
corpus_path = REPO / "experiments/widget-student-v1/artificial-corpus.json"
corpus = json.loads(corpus_path.read_text())
raw_index, normalized_index = defaultdict(list), defaultdict(list)
for index, item in enumerate(corpus):
    entry = {"corpus_index": index, "head": item["head"], "family": item["family"], "split": item["split"], "label": item["label"]}
    raw_index[item["text"]].append(entry)
    normalized_index[normalize(item["text"])].append(entry)
overlap = []
for case in fixture["cases"]:
    raw = raw_index.get(case["text"], [])
    normalized = normalized_index.get(normalize(case["text"]), [])
    if normalized:
        overlap.append({"id": case["id"], "category": case["category"], "text": case["text"],
                        "exact": bool(raw), "normalized": True, "matches": normalized})
excluded = {item["id"] for item in overlap}

models = {}
for name, raw_name, scored_name in [
    ("student-freeze-1", "results/student-freeze-1-first-pass.json", "results/student-freeze-1-first-pass-scored.json"),
    ("rules-preserved", "results/rules-preserved-first-pass.json", "results/rules-preserved-first-pass-scored.json"),
]:
    raw, scored = read(raw_name), read(scored_name)
    rows = scored["rows"]
    definite = [row for row in rows if row["expected_action"] != "any"]
    positive = [row for row in rows if row["expected_action"] == "render"]
    accepted = [row for row in definite if row["actual_action"] == "render" and row["safe_program"]]
    accepted_positive = [row for row in positive if row["actual_action"] == "render" and row["safe_program"]]
    cleaned_definite = [row for row in definite if row["id"] not in excluded]
    cleaned_positive = [row for row in positive if row["id"] not in excluded]
    hold_negative = [row for row in rows if row["expected_action"] == "hold" and row["category"] == "hold_negation_ambiguity"]
    by_id = {item["id"]: item for item in raw["predictions"]}
    failures = []
    for row in rows:
        if not row["semantic_success"] or row.get("geometry_failure"):
            case = next(case for case in fixture["cases"] if case["id"] == row["id"])
            failures.append({"id": row["id"], "category": row["category"], "text": case["text"],
                             "expected": case["expected"], "prediction": by_id[row["id"]], "scored": row})
    models[name] = {
        "scored_summary": scored["summary"],
        "accepted_definite_outputs": len(accepted),
        "accepted_definite_output_successes": sum(row["semantic_success"] for row in accepted),
        "accepted_definite_precision": sum(row["semantic_success"] for row in accepted) / len(accepted),
        "positive_program_coverage_count": len(accepted_positive),
        "positive_program_coverage": len(accepted_positive) / len(positive),
        "positive_accepted_precision": sum(row["semantic_success"] for row in accepted_positive) / len(accepted_positive),
        "negation_cancellation_conflict_hold_successes": sum(row["semantic_success"] for row in hold_negative),
        "negation_cancellation_conflict_hold_cases": len(hold_negative),
        "ambiguous_held": sum(row["actual_action"] == "hold" for row in rows if row["expected_action"] == "any"),
        "normalized_overlap_excluded": {
            "definite_count": len(cleaned_definite), "definite_semantic_successes": sum(row["semantic_success"] for row in cleaned_definite),
            "definite_accuracy": sum(row["semantic_success"] for row in cleaned_definite) / len(cleaned_definite),
            "positive_count": len(cleaned_positive), "positive_semantic_successes": sum(row["semantic_success"] for row in cleaned_positive),
        },
        "failures": failures,
    }
write_once("results/overlap-and-comparison-v1.json", {
    "fixture_sha256": sha256((ROOT / "fixture-90-v1.json").read_bytes()).hexdigest(),
    "corpus_sha256": sha256(corpus_path.read_bytes()).hexdigest(),
    "corpus_inspected_only_after_first_run": True,
    "normalized_function": "NFKC, lowercase, whitespace collapse, trim; Python implementation for this artificial JA/EN set.",
    "raw_overlap_case_count": sum(item["exact"] for item in overlap),
    "normalized_overlap_case_count": len(overlap), "overlap_cases": overlap,
    "note": "Exact-match exclusion is not a guarantee of semantic-family or near-duplicate separation. The six primitive vocabulary is intentionally shared.",
    "models": models,
})
print(json.dumps({"exact_overlaps": sum(item["exact"] for item in overlap), "normalized_overlaps": len(overlap),
                  "overlap_ids": sorted(excluded),
                  "models": {name: {key: value for key, value in model.items() if key not in {"scored_summary", "failures"}} for name, model in models.items()}}, ensure_ascii=False, indent=2))
